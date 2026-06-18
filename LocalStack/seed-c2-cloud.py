"""
LocalStack init hook (READY stage) — Challenge 2's cloud layer: a two-hop
credential-chaining privilege escalation via AWS Secrets Manager. Distinct
from Challenge 1's single-step S3 exfil (see seed-iam.py, run alongside
this file in the same ready.d mount) — this is "leaked creds -> secret ->
stronger creds -> secret -> flag," not "leaked creds -> bucket -> flag."

THE CHAIN:
  1. c2-ci-runner (low-priv) — its access key/secret are the creds planted
     root-only inside the Challenge 2 container at /root/ci-deploy-key.env
     (see challenges/challenge-2/entrypoint.sh's FLAG_CI_ACCESS_KEY_ID /
     FLAG_CI_SECRET_ACCESS_KEY). A learner who's already escalated to root
     via the container-layer sudo-find privesc finds this file sitting
     right next to /root/flag.txt.
  2. Those creds can list every secret and read ONE of them:
     'acme/ci/deploy-keys' — which contains c2-admin's (stronger) access
     key/secret. Reading it is HOP 1. This is the misconfiguration: a
     low-priv CI identity's read scope reaches a secret that itself holds
     stronger credentials — real-world "secrets sprawl," not a new
     software vulnerability.
  3. c2-admin's creds can read the final secret, 'acme/prod/master', whose
     value IS the flag. Reading it is HOP 2 — the prize. Must match
     server/db/seed.js's 'c2-cloud-privesc' row EXACTLY (that's the
     flag_hash a learner's retrieved value is checked against).

Same in-process moto-backend technique as seed-iam.py for the IAM
identities (see that file's module docstring for why access keys need
direct backend manipulation, not the standard CreateAccessKey API — the
short version: AWS/moto always random-generate both, there's no supported
override) and the same plain-boto3-against-the-real-API technique for the
resources the identities reach (Secrets Manager secrets, like Challenge 1's
S3 bucket, accept exactly the name/value given — no random-ID problem).

HONEST LIMITATION (identical to seed-iam.py's, verified there and equally
true here): LocalStack Community does not enforce IAM authorization, so
c2-ci-runner's creds could technically also read 'acme/prod/master'
directly, skipping the intended chain (confirmed for S3 in seed-iam.py;
Secrets Manager has no reason to differ — same Community edition, same
lack of an enforcement engine). The attached policies are real and
inspectable (`aws iam get-user-policy`) and correctly represent the
intended boundary — a genuinely scoped-but-too-broad grant, not blanket
secretsmanager:*/admin — but this sandbox doesn't runtime-gate on them.
The escalation IS real, though: each step (read a secret, get real
credentials back, configure them, read the next secret) is a real, working
action performed with real retrieved values — not a scripted hand-off.

Idempotent: identity/key checks are by final value before creating
anything; put_secret_value / create_secret-with-fallback overwrite (same
idempotent-by-construction shape as S3 PutObject); put_user_policy
overwrites. A fresh `docker compose up` (or a restart against a persisted
localstack-data volume) safely re-seeds everything without erroring or
creating duplicates.
"""

import json

import boto3
from botocore.exceptions import ClientError

from moto.iam.models import iam_backends
from moto.utilities.utils import get_partition
from localstack.constants import DEFAULT_AWS_ACCOUNT_ID

REGION = "us-east-1"
LOCALSTACK_ENDPOINT = "http://localhost:4566"

# ── Identity A: c2-ci-runner (low-priv) ──────────────────────────────────────
# Must match challenges/challenge-2/entrypoint.sh's planted
# /root/ci-deploy-key.env EXACTLY — this is the real credential a learner
# extracts from the container, not a fictional pair.
CI_RUNNER_USER = "c2-ci-runner"
CI_RUNNER_ACCESS_KEY_ID = "AKIAC2CIRUNNERBOT001"
CI_RUNNER_SECRET_ACCESS_KEY = "C2ciRunnerFakeSecretKeyEXAMPLE12345678AB"
assert len(CI_RUNNER_ACCESS_KEY_ID) == 20, "access key id must be 20 chars (real AWS format)"
assert len(CI_RUNNER_SECRET_ACCESS_KEY) == 40, "secret access key must be 40 chars (real AWS format)"

# ── Identity B: c2-admin (stronger) — the HOP 1 prize ────────────────────────
ADMIN_USER = "c2-admin"
ADMIN_ACCESS_KEY_ID = "AKIAC2ADMINPRODKEY01"
ADMIN_SECRET_ACCESS_KEY = "C2AdminProdFakeSecretKeyEXAMPLE87654321Z"
assert len(ADMIN_ACCESS_KEY_ID) == 20, "access key id must be 20 chars (real AWS format)"
assert len(ADMIN_SECRET_ACCESS_KEY) == 40, "secret access key must be 40 chars (real AWS format)"

# ── Secret #1 (HOP 1): ci-runner can read this; it contains admin creds ─────
CI_DEPLOY_SECRET_NAME = "acme/ci/deploy-keys"

# ── Secret #2 (HOP 2): only c2-admin is INTENDED to read this ───────────────
PROD_MASTER_SECRET_NAME = "acme/prod/master"

# Must match server/db/seed.js's 'c2-cloud-privesc' row's flag EXACTLY.
FLAG_CONTENT = "flag{cloud_credential_escalation}"


def _ci_deploy_secret_value():
    return json.dumps({
        "AWS_ACCESS_KEY_ID": ADMIN_ACCESS_KEY_ID,
        "AWS_SECRET_ACCESS_KEY": ADMIN_SECRET_ACCESS_KEY,
        "note": "prod admin deploy key -- emergency rotation use only",
    })


def _iam_backend():
    return iam_backends[DEFAULT_AWS_ACCOUNT_ID][get_partition(REGION)]


def _ensure_user_with_key(backend, user_name, access_key_id, secret_access_key):
    user = backend.users.get(user_name)
    if user is None:
        user, _ = backend.create_user(region_name=REGION, user_name=user_name)
        print(f"[seed-c2-cloud] created IAM user '{user_name}' ({user.arn})")
    else:
        print(f"[seed-c2-cloud] IAM user '{user_name}' already exists ({user.arn}) — reusing")

    existing_keys = backend.list_access_keys(user_name)
    already_seeded = any(k.access_key_id == access_key_id for k in existing_keys)
    if already_seeded:
        print(f"[seed-c2-cloud] access key {access_key_id} already present on '{user_name}' — skipping")
    else:
        key = backend.create_access_key(user_name, prefix="AKIA")
        key.access_key_id = access_key_id
        key.secret_access_key = secret_access_key
        print(f"[seed-c2-cloud] planted access key {access_key_id} on '{user_name}'")

    # Sanity self-check, same as seed-iam.py: resolve the identity the
    # exact same way STS's GetCallerIdentity does.
    resolved = backend.get_user_from_access_key_id(access_key_id)
    assert resolved is not None and resolved.name == user_name, (
        f"seed-c2-cloud: {access_key_id} did not resolve back to {user_name} after seeding"
    )
    print(f"[seed-c2-cloud] verified: {access_key_id} resolves to {resolved.arn}")


def _ensure_secret(sm_client, name, value):
    try:
        sm_client.create_secret(Name=name, SecretString=value)
        print(f"[seed-c2-cloud] created secret '{name}'")
    except ClientError as err:
        code = err.response.get("Error", {}).get("Code")
        if code != "ResourceExistsException":
            raise
        sm_client.put_secret_value(SecretId=name, SecretString=value)
        print(f"[seed-c2-cloud] secret '{name}' already existed — refreshed value (idempotent)")


def seed_two_hop_chain():
    backend = _iam_backend()

    _ensure_user_with_key(backend, CI_RUNNER_USER, CI_RUNNER_ACCESS_KEY_ID, CI_RUNNER_SECRET_ACCESS_KEY)
    _ensure_user_with_key(backend, ADMIN_USER, ADMIN_ACCESS_KEY_ID, ADMIN_SECRET_ACCESS_KEY)

    # ci-runner: can enumerate every secret (ListSecrets isn't meaningfully
    # resource-scopable in real IAM either — it's an account-wide listing
    # action) but can only READ its own deploy-keys secret, not
    # prod/master. THIS is the misconfiguration: a low-priv CI identity's
    # read scope reaches a secret that itself holds stronger credentials.
    ci_runner_policy = f"""{{
  "Version": "2012-10-17",
  "Statement": [
    {{
      "Effect": "Allow",
      "Action": ["secretsmanager:ListSecrets"],
      "Resource": "*"
    }},
    {{
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
      "Resource": "arn:aws:secretsmanager:{REGION}:{DEFAULT_AWS_ACCOUNT_ID}:secret:{CI_DEPLOY_SECRET_NAME}-??????"
    }}
  ]
}}"""
    backend.put_user_policy(CI_RUNNER_USER, "CiRunnerDeployKeysAccess", ci_runner_policy)
    print(f"[seed-c2-cloud] attached policy 'CiRunnerDeployKeysAccess' to '{CI_RUNNER_USER}'")

    # c2-admin: scoped to prod/master only — not secretsmanager:*, not
    # access to the ci/deploy-keys secret it doesn't need.
    admin_policy = f"""{{
  "Version": "2012-10-17",
  "Statement": [
    {{
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"],
      "Resource": "arn:aws:secretsmanager:{REGION}:{DEFAULT_AWS_ACCOUNT_ID}:secret:{PROD_MASTER_SECRET_NAME}-??????"
    }}
  ]
}}"""
    backend.put_user_policy(ADMIN_USER, "AdminProdMasterAccess", admin_policy)
    print(f"[seed-c2-cloud] attached policy 'AdminProdMasterAccess' to '{ADMIN_USER}'")

    # Secrets Manager side: plain boto3 against the real API. Dummy
    # test/test creds for this setup call — see the module docstring on
    # why that's fine (Community doesn't enforce IAM either way).
    sm = boto3.client(
        "secretsmanager",
        endpoint_url=LOCALSTACK_ENDPOINT,
        region_name=REGION,
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )

    _ensure_secret(sm, CI_DEPLOY_SECRET_NAME, _ci_deploy_secret_value())
    _ensure_secret(sm, PROD_MASTER_SECRET_NAME, FLAG_CONTENT)

    # Sanity self-checks: fail loudly here in the container logs, not by
    # silently shipping a broken/unsolvable chain.
    deploy_val = sm.get_secret_value(SecretId=CI_DEPLOY_SECRET_NAME)["SecretString"]
    assert ADMIN_ACCESS_KEY_ID in deploy_val and ADMIN_SECRET_ACCESS_KEY in deploy_val, (
        f"seed-c2-cloud: {CI_DEPLOY_SECRET_NAME} does not contain {ADMIN_USER}'s creds"
    )
    prod_val = sm.get_secret_value(SecretId=PROD_MASTER_SECRET_NAME)["SecretString"]
    assert prod_val == FLAG_CONTENT, (
        f"seed-c2-cloud: {PROD_MASTER_SECRET_NAME} content mismatch — got {prod_val!r}"
    )
    print(
        f"[seed-c2-cloud] verified chain: {CI_DEPLOY_SECRET_NAME} -> {ADMIN_USER} creds "
        f"-> {PROD_MASTER_SECRET_NAME} -> {FLAG_CONTENT}"
    )


seed_two_hop_chain()
