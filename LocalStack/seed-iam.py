"""
LocalStack init hook (READY stage) — cloud layer, all 3 stages.

STAGE 2 (seed_deploy_bot_identity): seeds a REAL IAM identity in LocalStack
matching the credentials the Challenge-1 web container leaks at
/root/.aws/credentials (see challenges/challenge-1/web/entrypoint.sh, the
sqli_docker_misconfig flag):

    aws_access_key_id     = AKIAAWSDEPLOYBOT2026
    aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

So a learner who loots those creds and configures them gets a genuine
`aws sts get-caller-identity` response naming the deploy-bot user — not
LocalStack's generic default identity — proving the leaked creds are a
real cloud foothold.

WHY A PYTHON SCRIPT, NOT A SHELL SCRIPT CALLING THE AWS CLI: the standard
IAM CreateAccessKey API (what `aws iam create-access-key` calls) never
accepts a caller-supplied access key ID or secret — AWS itself, and moto
(what LocalStack's IAM/STS emulation is built on), always random-generate
both, and there is no supported flag/tag/param that overrides this.
Verified directly against this exact LocalStack build before writing this
script: neither `--tags` on the CLI nor extra unsigned form params on a
raw CreateAccessKey HTTP call have any effect — both are silently ignored
and a random key comes back regardless.

THE ACTUAL MECHANISM: LocalStack's init-hook runner executes `.py` scripts
via `exec()` IN-PROCESS (localstack/runtime/init.py's PythonScriptRunner),
not as a subprocess — so this script runs inside the SAME Python process
as the live server and can reach into moto's real, live IAM backend state
directly, by importing it. STS's GetCallerIdentity resolves an access key
to its owning user via a plain attribute scan
(moto.iam.models.IAMBackend.get_user_from_access_key_id:
`access_key.access_key_id == access_key_id`) — so overwriting an
AccessKey object's .access_key_id/.secret_access_key attributes right
after creating it is sufficient; no internal dict needs re-keying for
authentication/identity resolution to work. Verified live against this
build (an interactive session inside the running container, using the
exact same venv) before writing this script down.

STAGE 3 (seed_misconfigured_bucket): creates the over-permissive S3 bucket
'acme-payments-backups' (a real flag object at flag.txt, plus a decoy
matching the "db-dump-2026-08-20.sql.gz" name already referenced in
challenges/challenge-1/web/backups/README.txt — same fictional backup
pipeline, different leak vector), and widens deploy-bot's IAM policy with
a SECOND, separately-named inline policy scoped only to that bucket
(s3:ListBucket + s3:GetObject on arn:...:s3:::acme-payments-backups and
its /* objects) — a realistic, narrow over-grant, not blanket s3:* or
admin access. Unlike IAM access keys, S3's CreateBucket/PutObject accept
exactly the names given (no random-ID problem), so this part uses plain
boto3 against LocalStack's real HTTP API rather than direct backend
manipulation.

HONEST LIMITATION, verified directly against this build: LocalStack
Community does not enforce IAM authorization at all — a request signed
with generic, policy-less 'test'/'test' credentials can list and read this
bucket exactly as freely as deploy-bot can (confirmed by testing both
before writing this comment). IAM policy enforcement (ENFORCE_IAM /
IAM_SOFT_MODE) is a LocalStack PRO feature; grepping this Community image's
own source confirms those config keys are recognized only by the telemetry
module, with no enforcement logic anywhere in this build. The policy
attached below is therefore real and inspectable (`aws iam
get-user-policy`) and represents the misconfiguration accurately — it is
what a genuine over-permissive AWS policy for this scenario would look
like — but it is not, in this sandbox, the thing technically gating
access. The exploit's realism comes from "here is a real leaked identity,
here is a real bucket it can reach, here is the (accurately scoped, not
blanket) policy that explains why" — not from LocalStack blocking a
hypothetical unauthorized attempt.

Idempotent throughout: the IAM identity/key checks are by FINAL value
before creating anything; the bucket is only created if missing;
put_object and put_user_policy are naturally idempotent (S3 PUT and IAM
put-policy both overwrite). A fresh `docker compose up` (or a restart
against a persisted localstack-data volume) safely re-seeds everything
without erroring or creating duplicates.
"""

import boto3
from botocore.exceptions import ClientError

from moto.iam.models import iam_backends
from moto.utilities.utils import get_partition
from localstack.constants import DEFAULT_AWS_ACCOUNT_ID

REGION = "us-east-1"
USER_NAME = "deploy-bot"

# Must match challenges/challenge-1/web/entrypoint.sh's planted
# /root/.aws/credentials EXACTLY — this is not a fictional pair, it's the
# real secret a learner extracts from the container.
LEAKED_ACCESS_KEY_ID = "AKIAAWSDEPLOYBOT2026"
LEAKED_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

# Realistic for a CI/deploy identity (it can enumerate buckets — a common,
# minimal permission real deploy tooling needs), but deliberately NOT yet
# exploitable: no object-level S3 access (no GetObject/PutObject), nothing
# else attached. STAGE 3 is what turns this into an actual data-exposure
# foothold (a misconfigured bucket this same identity can reach into).
DEPLOY_BOT_POLICY_NAME = "DeployBotPolicy"
DEPLOY_BOT_POLICY = """{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListAllMyBuckets", "s3:GetBucketLocation"],
      "Resource": "*"
    }
  ]
}"""

# ── STAGE 3: the misconfigured bucket + the over-grant that reaches it ──────

LOCALSTACK_ENDPOINT = "http://localhost:4566"
BUCKET_NAME = "acme-payments-backups"

# Must match seed.js's aws-layer challenge-1 row (slug 'sqli-iam-exfil')
# EXACTLY — that's the flag_hash a learner's exfiltrated object content is
# checked against by the terminal scanner.
FLAG_OBJECT_KEY = "flag.txt"
FLAG_CONTENT = b"flag{sqli_aws_iam_exfil}"

# Same filename the container's own backup manifest
# (challenges/challenge-1/web/backups/README.txt) already references — one
# fictional "nightly backup" pipeline, two different leak vectors (a leaked
# SSH key in the container, a leaked bucket in the cloud).
DECOY_OBJECT_KEY = "db-dump-2026-08-20.sql.gz"
DECOY_CONTENT = b"PK\x03\x04-fake-gzip-decoy-content-not-a-real-archive-"

# A SEPARATE, distinctly-named policy from the Stage 2 baseline above —
# inspectable on its own (`aws iam list-user-policies` shows both) as the
# one specific over-grant that makes this bucket reachable. Scoped to
# exactly this bucket, not s3:* / not admin.
BACKUPS_MISCONFIG_POLICY_NAME = "DeployBotBackupsMisconfig"
BACKUPS_MISCONFIG_POLICY = f"""{{
  "Version": "2012-10-17",
  "Statement": [
    {{
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::{BUCKET_NAME}",
        "arn:aws:s3:::{BUCKET_NAME}/*"
      ]
    }}
  ]
}}"""


def seed_deploy_bot_identity():
    backend = iam_backends[DEFAULT_AWS_ACCOUNT_ID][get_partition(REGION)]

    user = backend.users.get(USER_NAME)
    if user is None:
        user, _ = backend.create_user(region_name=REGION, user_name=USER_NAME)
        print(f"[seed-iam] created IAM user '{USER_NAME}' ({user.arn})")
    else:
        print(f"[seed-iam] IAM user '{USER_NAME}' already exists ({user.arn}) — reusing")

    existing_keys = backend.list_access_keys(USER_NAME)
    already_seeded = any(k.access_key_id == LEAKED_ACCESS_KEY_ID for k in existing_keys)

    if already_seeded:
        print(f"[seed-iam] access key {LEAKED_ACCESS_KEY_ID} already present — skipping")
    else:
        key = backend.create_access_key(USER_NAME, prefix="AKIA")
        key.access_key_id = LEAKED_ACCESS_KEY_ID
        key.secret_access_key = LEAKED_SECRET_ACCESS_KEY
        print(f"[seed-iam] planted access key {LEAKED_ACCESS_KEY_ID} on '{USER_NAME}'")

    # put_user_policy has overwrite semantics for a given (user, policy
    # name) — safe to call every run, never accumulates duplicates.
    backend.put_user_policy(USER_NAME, DEPLOY_BOT_POLICY_NAME, DEPLOY_BOT_POLICY)
    print(f"[seed-iam] attached policy '{DEPLOY_BOT_POLICY_NAME}' to '{USER_NAME}'")

    # Sanity self-check: resolve the identity the EXACT same way STS's
    # GetCallerIdentity does, so a broken seed fails loudly in the
    # LocalStack container logs instead of silently leaving the leaked
    # creds unauthenticated.
    resolved = backend.get_user_from_access_key_id(LEAKED_ACCESS_KEY_ID)
    assert resolved is not None and resolved.name == USER_NAME, (
        "seed-iam: leaked access key did not resolve back to deploy-bot after seeding"
    )
    print(f"[seed-iam] verified: {LEAKED_ACCESS_KEY_ID} resolves to {resolved.arn}")


def seed_misconfigured_bucket():
    # Plain boto3 against LocalStack's real S3 API — bucket/object names
    # are exactly what's given (no random-ID problem like IAM access keys
    # have), so there's no need for the backend-internals approach above.
    # Dummy 'test'/'test' creds: LocalStack accepts any credentials for
    # these setup calls regardless (see the module docstring's note on
    # Community-edition IAM enforcement).
    s3 = boto3.client(
        "s3",
        endpoint_url=LOCALSTACK_ENDPOINT,
        region_name=REGION,
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )

    existing = {b["Name"] for b in s3.list_buckets().get("Buckets", [])}
    if BUCKET_NAME in existing:
        print(f"[seed-iam] bucket '{BUCKET_NAME}' already exists — reusing")
    else:
        try:
            s3.create_bucket(Bucket=BUCKET_NAME)
            print(f"[seed-iam] created bucket '{BUCKET_NAME}'")
        except ClientError as err:
            code = err.response.get("Error", {}).get("Code")
            if code not in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
                raise
            print(f"[seed-iam] bucket '{BUCKET_NAME}' already exists ({code}) — reusing")

    # PutObject always overwrites — idempotent by construction, safe to
    # call unconditionally every run.
    s3.put_object(Bucket=BUCKET_NAME, Key=FLAG_OBJECT_KEY, Body=FLAG_CONTENT)
    s3.put_object(Bucket=BUCKET_NAME, Key=DECOY_OBJECT_KEY, Body=DECOY_CONTENT)
    print(f"[seed-iam] seeded {FLAG_OBJECT_KEY} + {DECOY_OBJECT_KEY} in '{BUCKET_NAME}'")

    # The misconfiguration itself: widen deploy-bot with a second, narrowly
    # scoped policy (put_user_policy overwrites — idempotent).
    backend = iam_backends[DEFAULT_AWS_ACCOUNT_ID][get_partition(REGION)]
    backend.put_user_policy(USER_NAME, BACKUPS_MISCONFIG_POLICY_NAME, BACKUPS_MISCONFIG_POLICY)
    print(f"[seed-iam] attached policy '{BACKUPS_MISCONFIG_POLICY_NAME}' to '{USER_NAME}'")

    # Sanity self-check: read the object back through the same S3 API a
    # learner's `aws s3 cp` will use, and confirm it's exactly the flag —
    # a broken seed (wrong bytes, wrong key) fails loudly here instead of
    # silently shipping an unsolvable cloud flag.
    body = s3.get_object(Bucket=BUCKET_NAME, Key=FLAG_OBJECT_KEY)["Body"].read()
    assert body == FLAG_CONTENT, (
        f"seed-iam: flag object content mismatch — got {body!r}, expected {FLAG_CONTENT!r}"
    )
    print(f"[seed-iam] verified: s3://{BUCKET_NAME}/{FLAG_OBJECT_KEY} == {FLAG_CONTENT.decode()}")


seed_deploy_bot_identity()
seed_misconfigured_bucket()
