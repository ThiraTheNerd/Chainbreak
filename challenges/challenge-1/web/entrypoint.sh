#!/bin/sh
# Runs as root (the container's default user — no USER directive was set in
# the Dockerfile) so it can plant a genuinely root-only flag file, then drops
# privileges for the actual app process. The app itself must never run as root.

# Root-only flag: owned root:root, mode 600 — APP_USER genuinely cannot read
# this without escalating via the SUID /usr/local/bin/backup-helper binary.
if [ -z "$FLAG_PRIVESC" ]; then
  FLAG_PRIVESC='flag{sqli_privesc_root}'
fi
echo "$FLAG_PRIVESC" > /root/flag.txt
chown root:root /root/flag.txt
chmod 600 /root/flag.txt

# INTENTIONALLY VULNERABLE — leaked AWS credentials (do not fix). A real
# planted file, not simulated JSON: root-only (600), so the SUID privesc
# above is a genuine prerequisite — a low-priv user gets Permission denied.
# The access key id/secret are placeholders wired up for the future
# AWS/LocalStack layer; only the flag inside is live for now. No added
# container privilege of any kind (no docker.sock, no --privileged, no
# capabilities) — this is discoverable purely by reading a file as root.
if [ -z "$FLAG_DOCKER_MISCONFIG" ]; then
  FLAG_DOCKER_MISCONFIG='flag{sqli_docker_misconfig}'
fi
mkdir -p /root/.aws
cat > /root/.aws/credentials <<EOF
[default]
aws_access_key_id = AKIAAWSDEPLOYBOT2026
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
# TODO: rotate — deploy bot creds should never have shipped in this image
# $FLAG_DOCKER_MISCONFIG
EOF
chown -R root:root /root/.aws
chmod 700 /root/.aws
chmod 600 /root/.aws/credentials

# Breadcrumb, not a spoon-feed: root's own shell history hints that AWS
# creds are worth looking for, without naming the exact path. Also
# root-only (matches how a real root .bash_history is permissioned), so it
# only becomes visible once the learner has actually escalated.
cat > /root/.bash_history <<'EOF'
whoami
id
apk info -v
aws configure
cat /root/.aws/credentials
history -c
EOF
chown root:root /root/.bash_history
chmod 600 /root/.bash_history

# INTENTIONALLY VULNERABLE — SSH-pivot flag (do not fix). Printed from
# APP_USER's .bash_profile — sourced ONLY by a genuine LOGIN shell, which is
# exactly what sshd starts on a successful interactive login (docker exec's
# own non-login shells never source this) — so the flag is awarded on
# actually pivoting in over SSH, not merely possessing the cracked key. The
# value is baked into the file's CONTENT at container start (not left for the
# SSH session to read from its own environment, which isn't guaranteed to
# inherit sshd's env — see FLAG_PRIVESC/FLAG_DOCKER_MISCONFIG above for the
# same reasoning). Printed once per login, not per command.
if [ -z "$FLAG_SSH_PIVOT" ]; then
  FLAG_SSH_PIVOT='flag{sqli_ssh_pivot}'
fi
cat > /home/"$APP_USER"/.bash_profile <<EOF
echo "[+] SSH pivot successful — $FLAG_SSH_PIVOT"
EOF
chown "$APP_USER":"$APP_USER" /home/"$APP_USER"/.bash_profile
chmod 644 /home/"$APP_USER"/.bash_profile

# SSH pivot foothold: sshd must run as root (it only setuid()s to the
# connecting user AFTER successful pubkey auth). Host keys, authorized_keys,
# and the leaked private key are all baked in at build time (see Dockerfile).
# sshd daemonizes itself, so this returns immediately.
/usr/sbin/sshd

# Start the vulnerable application as the low-privilege service account.
su-exec "$APP_USER" node /app/app.js &

# Keep the container alive so docker exec can spawn terminal sessions
tail -f /dev/null
