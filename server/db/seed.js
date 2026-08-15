import bcrypt from 'bcrypt';
import pool from './connection.js';

const ROUNDS = 12;

async function seed() {
  console.log('Seeding database...');

  const users = [
    { username: 'admin', email: 'admin@chainbreak.local', password: 'Admin1234!',  role: 'admin'       },
    { username: 'alice', email: 'alice@test.com',         password: 'Alice1234!',  role: 'participant' },
    { username: 'bob',   email: 'bob@test.com',           password: 'Bob1234!',    role: 'participant' },
    { username: 'p01',   email: 'p01@research.local',     password: 'Part01Pass!', role: 'participant' },
    { username: 'p02',   email: 'p02@research.local',     password: 'Part02Pass!', role: 'participant' },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, ROUNDS);
    const [r] = await pool.execute(
      `INSERT IGNORE INTO users (username, email, password_hash, role)
       VALUES (?, ?, ?, ?)`,
      [u.username, u.email, hash, u.role]
    );
    console.log(r.affectedRows
      ? `  created user    : ${u.username} (${u.role})`
      : `  skipped (exists): ${u.username}`
    );
  }

  const challenges = [
    {
      slug:         'master-challenge',
      title:        'Master Challenge',
      description:  'A standalone capstone challenge for the ChainBreak platform.',
      layer:        'owasp',
      category:     'Capstone challenge',
      difficulty:   'hard',
      flag:         'flag{master_challenge}',
      points:       300,
      docker_image: null,
      network_alias:null,
    },
    {
      slug:         'sqli-login',
      title:        'SQL injection — login bypass',
      description:  'The login form constructs its query via string concatenation. Bypass authentication, capture the session token, and use your foothold to investigate the container environment.',
      layer:        'owasp',
      category:     'A03:2021 Injection',
      difficulty:   'medium',
      flag:         'flag{sqli_owasp_bypass}',
      points:       100,
      docker_image: 'chainbreak-challenge-1',
      network_alias:'web-challenge-1',
    },
    {
      slug:         'sqli-ssh-pivot',
      title:        'SSH pivot — leaked deploy key',
      description:  'Recover the leaked SSH key, crack its passphrase, and use it to pivot onto the container as the service account.',
      layer:        'docker',
      category:     'Lateral movement / credential pivot',
      difficulty:   'medium',
      flag:         'flag{sqli_ssh_pivot}',
      points:       150,
      docker_image: 'chainbreak-challenge-1',
      network_alias:'web-challenge-1',
    },
    {
      slug:         'sqli-docker-misconfig',
      title:        'Container misconfiguration — leaked AWS credentials',
      description:  'As root inside the container, enumerate the filesystem. The container carries AWS credentials it should never have — find and read them.',
      layer:        'docker',
      category:     'Container misconfiguration / credential exposure',
      difficulty:   'medium',
      flag:         'flag{sqli_docker_misconfig}',
      points:       150,
      docker_image: 'chainbreak-challenge-1',
      network_alias:'web-challenge-1',
    },
    {
      slug:         'sqli-privesc-root',
      title:        'Local privilege escalation — SUID binary',
      description:  'You have a low-privilege foothold on the target. A root-owned SUID binary is misconfigured — find it (find / -perm -4000) and abuse it to get a root shell, then read /root/flag.txt.',
      layer:        'docker',
      category:     'Privilege escalation (SUID)',
      difficulty:   'medium',
      flag:         'flag{sqli_privesc_root}',
      points:       150,
      docker_image: 'chainbreak-challenge-1',
      network_alias:'web-challenge-1',
    },
    {
      slug:         'sqli-broken-access',
      title:        'Broken access control — admin user list',
      description:  'An internal user-management endpoint checks for a valid session but never checks the caller\'s role. Authenticate as any user and reach the endpoint meant for admins only to capture the flag.',
      layer:        'owasp',
      category:     'A01:2021 Broken Access Control',
      difficulty:   'medium',
      flag:         'flag{sqli_broken_access}',
      points:       100,
      docker_image: 'chainbreak-challenge-1',
      network_alias:'web-challenge-1',
    },
    {
      slug:         'sqli-iam-exfil',
      title:        'IAM credential theft via IMDS',
      description:  'From the host, query the EC2 metadata service at 169.254.169.254 to steal IAM role credentials. Use them to enumerate the S3 bucket and retrieve the flag.',
      layer:        'aws',
      category:     'Cloud misconfiguration',
      difficulty:   'hard',
      flag:         'flag{sqli_aws_iam_exfil}',
      points:       200,
      docker_image: 'chainbreak-challenge-1',
      network_alias:'web-challenge-1',
    },
    {
    slug: 'deserialize-rce',
    title: 'Insecure Deserialization RCE',
    description: 'Reach code execution by abusing an unsafe node-serialize cookie (CVE-2017-5941).',
    layer: 'owasp',
    category: 'A03 Vulnerable Component / Insecure Deserialization',
    difficulty: 'medium',
    flag: 'flag{deserialize_rce_foothold}',
    points: 150,
    docker_image: 'chainbreak-challenge-2',
    network_alias: 'web-challenge-2',
    },
    {
      slug: 'c2-error-disclosure',
      title: 'Verbose Error Disclosure',
      description: 'Trigger the app\'s mishandled error path to leak internal details.',
      layer: 'owasp',
      category: 'A10 Mishandling of Exceptional Conditions',
      difficulty: 'easy',
      flag: 'flag{verbose_error_disclosure}',
      points: 100,
      docker_image: 'chainbreak-challenge-2',
      network_alias: 'web-challenge-2',
    },
    {
      slug: 'c2-container-privesc',
      title: 'Challenge 2 — Container Privilege Escalation',
      description: 'From the app-user foothold, escalate inside the container to read a root-only secret.',
      layer: 'docker',
      category: 'Container Privilege Escalation',
      difficulty: 'hard',
      flag: 'flag{container_root_escalation}',
      points: 200,
      docker_image: 'chainbreak-challenge-2',
      network_alias: 'web-challenge-2',
    },
      {
    slug: 'c2-weak-auth',
    title: 'Weak Authentication — Support Portal',
    description: 'Brute-force a weakly-protected login with no lockout to gain an authenticated session.',
    layer: 'owasp',
    category: 'A07 Authentication Failures',
    difficulty: 'medium',
    flag: 'flag{weak_auth_no_lockout}',
    points: 125,
    docker_image: 'chainbreak-challenge-2',
    network_alias: 'web-challenge-2',
  },
  {
    slug: 'c2-jwt-forge',
    title: 'JWT Secret Cracking — Privilege Forgery',
    description: 'Crack the weak HS256 signing secret offline and forge an admin token.',
    layer: 'owasp',
    category: 'A04 Cryptographic Failures',
    difficulty: 'hard',
    flag: 'flag{jwt_secret_cracked}',
    points: 150,
    docker_image: 'chainbreak-challenge-2',
    network_alias: 'web-challenge-2',
  },
  {
    slug: 'c2-cloud-privesc',
    title: 'Cloud Credential Escalation — CI to Prod',
    description: 'A leaked low-privilege CI deploy key can read an AWS Secrets Manager secret that itself contains stronger admin credentials. Chain the leaked creds through Secrets Manager — CI key, to a secret exposing prod admin creds, to the prod master secret — to reach the flag.',
    layer: 'aws',
    category: 'Cloud IAM / credential escalation',
    difficulty: 'hard',
    flag: 'flag{cloud_credential_escalation}',
    points: 200,
    docker_image: 'chainbreak-challenge-2',
    network_alias: 'web-challenge-2',
  },
  ];

  for (const c of challenges) {
    const flagHash = await bcrypt.hash(c.flag, ROUNDS);
    const [r] = await pool.execute(
      `INSERT IGNORE INTO challenges
         (slug, title, description, layer, category, difficulty, flag_hash, points, docker_image, network_alias)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.slug, c.title, c.description, c.layer, c.category,
       c.difficulty, flagHash, c.points, c.docker_image, c.network_alias]
    );
    console.log(r.affectedRows
      ? `  created challenge: ${c.slug} (${c.layer})`
      : `  skipped (exists) : ${c.slug}`
    );
  }

  console.log('\nSeed complete.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
