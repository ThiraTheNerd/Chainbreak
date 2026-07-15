/* backup-helper.c — INTENTIONALLY VULNERABLE, do not fix.
 *
 * Installed root:root, mode 4755 (setuid). A real backup tool that needs to
 * read root-owned files was "helpfully" made setuid-root instead of being
 * given a narrow, audited capability — a common real-world misconfiguration.
 * setuid on a SHELL SCRIPT is ignored by the Linux kernel, so this has to be
 * a compiled binary for the privilege escalation to actually work.
 *
 * Any local user who can execute this binary gets a root shell.
 */
#include <unistd.h>
#include <stdlib.h>

int main(void) {
    setuid(0);
    setgid(0);
    /* setuid()/setgid() change credentials, not environment — HOME is still
     * whatever the caller (paymentsvc) had, e.g. /home/paymentsvc. Left
     * alone, bash -l below would source PAYMENTSVC's ~/.bash_profile as
     * root (verified: it does), not root's own. Reset it so this is a
     * genuine root shell, HOME included. */
    setenv("HOME", "/root", 1);
    /* -l (login) makes bash source /etc/profile -> /etc/profile.d/*.sh,
     * which is where the system-wide prompt lives (see the Dockerfile) —
     * plain /bin/sh (busybox ash) neither expands \u/\h/\w prompt escapes
     * nor loads any profile, which is why the escalated shell used to be
     * bare instead of showing root@<host>:<cwd>#. */
    execl("/bin/bash", "bash", "-l", (char *)NULL);
    return 1; /* only reached if execl fails */
}
