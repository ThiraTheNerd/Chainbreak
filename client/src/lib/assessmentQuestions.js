// The backend answer key in routes/assessment.js must match these ids exactly.

export const SECTIONS = [
  { id: 'web',       label: 'Web security (1–10)',       range: [1,  10] },
  { id: 'container', label: 'Container security (11–23)', range: [11, 23] },
  { id: 'cloud',     label: 'Cloud security (24–33)',     range: [24, 33] },
]

export const QUESTIONS = [


  {
    id: 1, section: 'web',
    text: 'Which OWASP Top 10 (2021) category describes vulnerabilities where an authenticated user can access resources belonging to another user by manipulating URL parameters?',
    options: [
      { id:'A', text:'A03:2021 — Injection' },
      { id:'B', text:'A07:2021 — Identification and Authentication Failures' },
      { id:'C', text:'A01:2021 — Broken Access Control', correct: true },
      { id:'D', text:'A02:2021 — Cryptographic Failures' },
    ],
  },
  {
    id: 2, section: 'web',
    text: "A login form that constructs its SQL query as: SELECT * FROM users WHERE username='" + "' + input + '" + "' is vulnerable to which attack?",
    options: [
      { id:'A', text:'Cross-Site Scripting (XSS)' },
      { id:'B', text:'SQL Injection', correct: true },
      { id:'C', text:'Server-Side Request Forgery (SSRF)' },
      { id:'D', text:'Command Injection' },
    ],
  },
  {
    id: 3, section: 'web',
    text: 'Which HTTP response header helps mitigate reflected Cross-Site Scripting attacks by controlling which resources the browser is allowed to load?',
    options: [
      { id:'A', text:'X-Frame-Options' },
      { id:'B', text:'Strict-Transport-Security' },
      { id:'C', text:'Content-Security-Policy', correct: true },
      { id:'D', text:'X-Content-Type-Options' },
    ],
  },
  {
    id: 4, section: 'web',
    text: 'In OWASP Top 10 (2021), which category was newly introduced to address vulnerabilities in microservices and cloud-native architectures where attackers abuse the server to reach internal resources?',
    options: [
      { id:'A', text:'A04:2021 — Insecure Design' },
      { id:'B', text:'A08:2021 — Software and Data Integrity Failures' },
      { id:'C', text:'A09:2021 — Security Logging Failures' },
      { id:'D', text:'A10:2021 — Server-Side Request Forgery (SSRF)', correct: true },
    ],
  },
  {
    id: 5, section: 'web',
    text: 'What is the most effective mitigation against SQL Injection vulnerabilities in a Node.js/MySQL application?',
    options: [
      { id:'A', text:'Input length validation' },
      { id:'B', text:'Parameterised queries (prepared statements)', correct: true },
      { id:'C', text:'Client-side input sanitisation' },
      { id:'D', text:'Disabling error messages' },
    ],
  },
  {
    id: 6, section: 'web',
    text: 'Which of the following payloads would most likely exploit an OS command injection vulnerability in a Node.js ping utility that passes user input directly to exec()?',
    options: [
      { id:'A', text:"' OR '1'='1" },
      { id:'B', text:'<script>alert(1)</script>' },
      { id:'C', text:'127.0.0.1; cat /etc/passwd', correct: true },
      { id:'D', text:'../../../etc/passwd' },
    ],
  },
  {
    id: 7, section: 'web',
    text: 'A web application deserialises user-supplied data without validation. An attacker crafts a malicious serialised object. Which OWASP 2021 category does this fall under?',
    options: [
      { id:'A', text:'A03:2021 — Injection' },
      { id:'B', text:'A05:2021 — Security Misconfiguration' },
      { id:'C', text:'A08:2021 — Software and Data Integrity Failures', correct: true },
      { id:'D', text:'A06:2021 — Vulnerable and Outdated Components' },
    ],
  },
  {
    id: 8, section: 'web',
    text: 'Which HTTP method should a well-designed API use for an operation that retrieves a user profile by ID without modifying any server-side state?',
    options: [
      { id:'A', text:'POST' },
      { id:'B', text:'PUT' },
      { id:'C', text:'DELETE' },
      { id:'D', text:'GET', correct: true },
    ],
  },
  {
    id: 9, section: 'web',
    text: 'An SSRF vulnerability allows an attacker to make the server send a request to http://169.254.169.254/latest/meta-data/. What is the attacker most likely trying to access?',
    options: [
      { id:'A', text:"The application's database credentials" },
      { id:'B', text:'AWS EC2 instance metadata including attached IAM role credentials', correct: true },
      { id:'C', text:"The server's local file system" },
      { id:'D', text:"The application's source code" },
    ],
  },
  {
    id: 10, section: 'web',
    text: 'What does the Broken Access Control vulnerability A01:2021 cover that was not explicitly categorised in OWASP 2017?',
    options: [
      { id:'A', text:'SQL Injection via URL parameters' },
      { id:'B', text:'Cross-Origin Resource Sharing misconfigurations' },
      { id:'C', text:'Access control enforcement failures including IDOR and privilege escalation', correct: true },
      { id:'D', text:'Hardcoded credentials in source code' },
    ],
  },


  {
    id: 11, section: 'container',
    text: 'What is the primary security risk of running a Docker container with the --privileged flag?',
    options: [
      { id:'A', text:'The container cannot access the network' },
      { id:'B', text:"The container has full access to the host's devices and kernel capabilities, enabling host escape", correct: true },
      { id:'C', text:'The container runs as a non-root user by default' },
      { id:'D', text:'The container cannot write to its filesystem' },
    ],
  },
  {
    id: 12, section: 'container',
    text: 'An attacker gains remote code execution inside a Docker container and discovers the Docker socket (/var/run/docker.sock) is mounted inside the container. What can the attacker do?',
    options: [
      { id:'A', text:"Read the container's environment variables" },
      { id:'B', text:'Escape the container by spawning a new privileged container with the host filesystem mounted', correct: true },
      { id:'C', text:"Modify the host's network routing tables" },
      { id:'D', text:"Access the host's /etc/passwd file directly" },
    ],
  },
  {
    id: 13, section: 'container',
    text: 'Which Linux feature does Docker use to isolate container processes from each other and from the host?',
    options: [
      { id:'A', text:'AppArmor profiles' },
      { id:'B', text:'Namespaces and cgroups', correct: true },
      { id:'C', text:'iptables firewall rules' },
      { id:'D', text:'SELinux labels' },
    ],
  },
  {
    id: 14, section: 'container',
    text: 'What does the Linux capability CAP_NET_ADMIN allow a process inside a container to do?',
    options: [
      { id:'A', text:'Write to files owned by root' },
      { id:'B', text:'Perform network configuration including packet sniffing and ARP manipulation', correct: true },
      { id:'C', text:'Access GPU resources' },
      { id:'D', text:'Mount external filesystems' },
    ],
  },
  {
    id: 15, section: 'container',
    text: 'A Docker Compose file contains: volumes: - /:/host. What is the security implication?',
    options: [
      { id:'A', text:'The container can access the internet through the host' },
      { id:'B', text:"The host root filesystem is mounted inside the container, giving full host read/write access", correct: true },
      { id:'C', text:"The container inherits the host's DNS configuration" },
      { id:'D', text:"The container shares the host's network interface" },
    ],
  },
  {
    id: 16, section: 'container',
    text: 'Which Docker Compose configuration correctly removes all Linux capabilities from a container and then adds back only those explicitly required?',
    options: [
      { id:'A', text:'privileged: false' },
      { id:'B', text:'cap_drop: [ALL] with cap_add: [NET_BIND_SERVICE]', correct: true },
      { id:'C', text:'security_opt: [no-new-privileges:true]' },
      { id:'D', text:'read_only: true' },
    ],
  },
  {
    id: 17, section: 'container',
    text: 'What is the recommended practice for running application processes inside a Docker container from a security perspective?',
    options: [
      { id:'A', text:'Run as root to ensure full file system access' },
      { id:'B', text:'Run as a non-root user defined in the Dockerfile with USER instruction', correct: true },
      { id:'C', text:'Run with --privileged to avoid permission issues' },
      { id:'D', text:'Mount /etc from the host to inherit system users' },
    ],
  },
  {
    id: 18, section: 'container',
    text: 'An attacker exploits a web vulnerability and gains a shell inside a container. They run: find / -name docker.sock 2>/dev/null. What are they looking for?',
    options: [
      { id:'A', text:"The application's database connection string" },
      { id:'B', text:'The Docker daemon socket that would allow them to control Docker from inside the container', correct: true },
      { id:'C', text:"The container's network configuration file" },
      { id:'D', text:"The application's environment variable file" },
    ],
  },
  {
    id: 19, section: 'container',
    text: 'Which of the following best describes a container escape?',
    options: [
      { id:'A', text:"A technique for encrypting container network traffic" },
      { id:'B', text:'Breaking out of the container isolation boundary to gain access to the host operating system or other containers', correct: true },
      { id:'C', text:'Deleting a running container from the Docker daemon' },
      { id:'D', text:'Exporting a container image to a tar archive' },
    ],
  },
  {
    id: 20, section: 'container',
    text: 'What is the purpose of Docker network isolation between services in a Docker Compose application?',
    options: [
      { id:'A', text:'To prevent containers from communicating with each other entirely' },
      { id:'B', text:'To ensure services can only communicate with services on the same defined network, limiting lateral movement if one service is compromised', correct: true },
      { id:'C', text:'To encrypt all traffic between containers automatically' },
      { id:'D', text:'To prevent containers from accessing the internet' },
    ],
  },
  {
    id: 21, section: 'container',
    text: 'A file owned by root has the SUID bit set (-rwsr-xr-x). A low-privileged user runs it. What is the security risk?',
    options: [
      { id:'A', text:"It runs with the executing user's privileges, so SUID poses no risk." },
      { id:'B', text:"It runs with its owner's (root's) privileges, so if it can spawn a shell or run commands, the user gains root access.", correct: true },
      { id:'C', text:'A low-privileged user cannot execute it at all; SUID blocks non-owners.' },
      { id:'D', text:'SUID only affects scripts, so a compiled binary with it set behaves normally.' },
    ],
  },
  {
    id: 22, section: 'container',
    text: 'After gaining a foothold on a Linux host, how does an attacker find SUID binaries that might allow privilege escalation?',
    options: [
      { id:'A', text:'find / -type f -name "*.suid"' },
      { id:'B', text:'find / -perm -4000 2>/dev/null', correct: true },
      { id:'C', text:'ls -laR / | grep root' },
      { id:'D', text:'chmod -R 4000 /' },
    ],
  },
  {
    id: 23, section: 'container',
    text: 'A review finds an unnecessary custom SUID-root binary on a production server. What is the most appropriate fix?',
    options: [
      { id:'A', text:'Remove the SUID bit or the binary itself, applying least privilege.', correct: true },
      { id:'B', text:'Change the owner to a non-root user but keep the SUID bit.' },
      { id:'C', text:"Make it read-only (chmod 444) so it can't be modified." },
      { id:'D', text:"Move it to /root so low-privileged users can't find it." },
    ],
  },


  {
    id: 24, section: 'cloud',
    text: 'What is the AWS EC2 Instance Metadata Service (IMDS) and why is it a target in cloud attacks?',
    options: [
      { id:'A', text:'A service for monitoring EC2 instance performance metrics' },
      { id:'B', text:'An internal HTTP endpoint (169.254.169.254) that provides instance configuration data including attached IAM role credentials, accessible from within the instance', correct: true },
      { id:'C', text:'A service for encrypting data stored on EC2 volumes' },
      { id:'D', text:'An API for managing EC2 security groups' },
    ],
  },
  {
    id: 25, section: 'cloud',
    text: "An EC2 instance has an IAM role attached with the policy Action: '*', Resource: '*', Effect: Allow. What does this mean?",
    options: [
      { id:'A', text:'The instance can only read from S3 buckets' },
      { id:'B', text:'The instance has no AWS permissions by default' },
      { id:'C', text:'The instance can perform any action on any AWS resource — effectively full administrative access', correct: true },
      { id:'D', text:'The instance can only access services in the same AWS region' },
    ],
  },
  {
    id: 26, section: 'cloud',
    text: 'An S3 bucket has the following bucket policy: Principal: *, Effect: Allow, Action: s3:GetObject. What is the security implication?',
    options: [
      { id:'A', text:'Only authenticated IAM users can read objects' },
      { id:'B', text:'The bucket is publicly readable by anyone on the internet', correct: true },
      { id:'C', text:'Only the bucket owner can read objects' },
      { id:'D', text:'Objects in the bucket are automatically encrypted' },
    ],
  },
  {
    id: 27, section: 'cloud',
    text: 'What is the primary purpose of AWS IMDSv2 compared to IMDSv1?',
    options: [
      { id:'A', text:'IMDSv2 provides faster metadata retrieval' },
      { id:'B', text:'IMDSv2 requires a session token obtained via PUT request, preventing SSRF attacks from directly reading metadata', correct: true },
      { id:'C', text:'IMDSv2 encrypts metadata responses' },
      { id:'D', text:'IMDSv2 requires IAM authentication to access' },
    ],
  },
  {
    id: 28, section: 'cloud',
    text: 'An attacker obtains temporary IAM credentials (AccessKeyId, SecretAccessKey, SessionToken) from the EC2 metadata service. What can they do with them?',
    options: [
      { id:'A', text:'Nothing — temporary credentials expire immediately' },
      { id:'B', text:'Use them as environment variables or in AWS CLI to make API calls with the permissions of the attached IAM role', correct: true },
      { id:'C', text:'Only access S3 — temporary credentials are restricted to storage services' },
      { id:'D', text:'Only use them from within the same EC2 instance' },
    ],
  },
  {
    id: 29, section: 'cloud',
    text: 'Which AWS CLI command would an attacker use to identify what IAM permissions their stolen credentials have?',
    options: [
      { id:'A', text:'aws ec2 describe-instances' },
      { id:'B', text:'aws iam list-roles' },
      { id:'C', text:'aws sts get-caller-identity followed by aws iam simulate-principal-policy', correct: true },
      { id:'D', text:'aws cloudtrail lookup-events' },
    ],
  },
  {
    id: 30, section: 'cloud',
    text: 'What is the principle of least privilege as applied to AWS IAM?',
    options: [
      { id:'A', text:'Every IAM user should have AdministratorAccess to avoid permission errors' },
      { id:'B', text:'IAM roles and users should be granted only the minimum permissions required to perform their intended function', correct: true },
      { id:'C', text:'All S3 buckets should be publicly accessible by default' },
      { id:'D', text:'EC2 instances should not have IAM roles attached' },
    ],
  },
  {
    id: 31, section: 'cloud',
    text: 'An attacker with stolen IAM credentials runs: aws s3 ls s3://company-backups --no-sign-request. What are they attempting?',
    options: [
      { id:'A', text:'Deleting all objects in the S3 bucket' },
      { id:'B', text:'Listing the contents of the S3 bucket to identify data for exfiltration', correct: true },
      { id:'C', text:'Creating a new S3 bucket' },
      { id:'D', text:"Modifying the bucket's access policy" },
    ],
  },
  {
    id: 32, section: 'cloud',
    text: 'Which AWS service stores application secrets such as database passwords and API keys, and is a target for credential theft if IAM permissions are misconfigured?',
    options: [
      { id:'A', text:'AWS CloudTrail' },
      { id:'B', text:'AWS Secrets Manager', correct: true },
      { id:'C', text:'AWS Config' },
      { id:'D', text:'AWS Inspector' },
    ],
  },
  {
    id: 33, section: 'cloud',
    text: 'What is the most effective defence against SSRF attacks targeting the AWS EC2 metadata service?',
    options: [
      { id:'A', text:'Blocking all outbound traffic from the EC2 instance' },
      { id:'B', text:'Enforcing IMDSv2 (requiring session tokens) and restricting metadata access to only services that explicitly require it', correct: true },
      { id:'C', text:'Disabling the EC2 instance profile' },
      { id:'D', text:'Placing the EC2 instance in a private subnet' },
    ],
  },
]
export const POST_QUESTIONS = [


  {
    id: 1, section: 'web',
    text: 'An attacker modifies a user account ID in an HTTP GET request (e.g., changing /account?id=101 to /account?id=102) and successfully views another user’s personal record. Which OWASP Top 10 (2021) category does this exploit represent?',
    options: [
      { id:'A', text:'A03:2021 — Injection' },
      { id:'B', text:'A07:2021 — Identification and Authentication Failures' },
      { id:'C', text:'A01:2021 — Broken Access Control', correct: true },
      { id:'D', text:'A02:2021 — Cryptographic Failures' },
    ],
  },
  {
    id: 2, section: 'web',
    text: "When raw string concatenation is used to assemble database statements like: db.query('SELECT name FROM items WHERE code=' + req.query.code), the application becomes susceptible to which security issue?",
    options: [
      { id:'A', text:'Cross-Site Scripting (XSS)' },
      { id:'B', text:'SQL Injection', correct: true },
      { id:'C', text:'Server-Side Request Forgery (SSRF)' },
      { id:'D', text:'Command Injection' },
    ],
  },
  {
    id: 3, section: 'web',
    text: 'To restrict where client-side scripts, images, and objects can be dynamically loaded from, which security header should a server emit to mitigate client-side injection attacks?',
    options: [
      { id:'A', text:'X-Frame-Options' },
      { id:'B', text:'Strict-Transport-Security' },
      { id:'C', text:'Content-Security-Policy', correct: true },
      { id:'D', text:'X-Content-Type-Options' },
    ],
  },
  {
    id: 4, section: 'web',
    text: 'Which entry in the OWASP Top 10 (2021) list specifically targets scenarios where an application server is induced into making unauthorized, outbound requests to internal or restricted network assets?',
    options: [
      { id:'A', text:'A04:2021 — Insecure Design' },
      { id:'B', text:'A08:2021 — Software and Data Integrity Failures' },
      { id:'C', text:'A09:2021 — Security Logging Failures' },
      { id:'D', text:'A10:2021 — Server-Side Request Forgery (SSRF)', correct: true },
    ],
  },
  {
    id: 5, section: 'web',
    text: 'Which development practice best defends a backend Node.js database interface against SQL Injection vulnerabilities?',
    options: [
      { id:'A', text:'Applying regex pattern matching on input parameters' },
      { id:'B', text:'Using parameterized queries (prepared statements)', correct: true },
      { id:'C', text:'Sanitizing user inputs on the web client' },
      { id:'D', text:'Encoding database error output before display' },
    ],
  },
  {
    id: 6, section: 'web',
    text: 'A Web API executes shell statements using user-supplied parameters inside child_process.exec(). Which string input presents an OS command injection threat?',
    options: [
      { id:'A', text:"' OR 1=1 --" },
      { id:'B', text:'<iframe src="javascript:alert(1)"></iframe>' },
      { id:'C', text:'localhost && id', correct: true },
      { id:'D', text:'/etc/shadow' },
    ],
  },
  {
    id: 7, section: 'web',
    text: 'An application accepts serialized JavaScript objects over network requests and reconstructs them without safety checks, leading to remote code execution. Under which OWASP 2021 category is this risk classified?',
    options: [
      { id:'A', text:'A03:2021 — Injection' },
      { id:'B', text:'A05:2021 — Security Misconfiguration' },
      { id:'C', text:'A08:2021 — Software and Data Integrity Failures', correct: true },
      { id:'D', text:'A06:2021 — Vulnerable and Outdated Components' },
    ],
  },
  {
    id: 8, section: 'web',
    text: 'According to RESTful standards, which idempotent HTTP verb should be designated for endpoints that strictly fetch resources without altering data?',
    options: [
      { id:'A', text:'POST' },
      { id:'B', text:'PUT' },
      { id:'C', text:'DELETE' },
      { id:'D', text:'GET', correct: true },
    ],
  },
  {
    id: 9, section: 'web',
    text: 'An adversary leverages an SSRF flaw to send HTTP queries to http://169.254.169.254/latest/meta-data/. What target data are they attempting to extract?',
    options: [
      { id:'A', text:'The application host environment files' },
      { id:'B', text:'Cloud Instance Metadata, including temporary IAM role credentials', correct: true },
      { id:'C', text:'The local MySQL root passwords' },
      { id:'D', text:'Application source code repositories' },
    ],
  },
  {
    id: 10, section: 'web',
    text: 'How was OWASP A01:2021 (Broken Access Control) updated relative to prior OWASP frameworks?',
    options: [
      { id:'A', text:'It exclusively covers SQL Injection vectors' },
      { id:'B', text:'It addresses Cross-Origin Resource Sharing vulnerabilities' },
      { id:'C', text:'It consolidated multiple access flaws including IDOR, unauthorized privilege escalation, and bypasses', correct: true },
      { id:'D', text:'It isolated cleartext transmission of passcodes' },
    ],
  },


  {
    id: 11, section: 'container',
    text: 'Launching a container using docker run --privileged exposes the host system primarily to which container security risk?',
    options: [
      { id:'A', text:'Complete disabling of container networking capabilities' },
      { id:'B', text:'Granting the container full host device access and Linux capabilities, enabling host compromise', correct: true },
      { id:'C', text:'Enforcing read-only limits across the container image' },
      { id:'D', text:'Blocking host file system access completely' },
    ],
  },
  {
    id: 12, section: 'container',
    text: 'If an attacker gets execution context inside a container that has /var/run/docker.sock exposed, what attack path opens up?',
    options: [
      { id:'A', text:'Reading the memory state of sibling process IDs' },
      { id:'B', text:'Issuing commands directly to the Docker daemon to spawn a host-mounted container for total escape', correct: true },
      { id:'C', text:'Overwriting default IPTables firewall configurations' },
      { id:'D', text:'Inspecting host user passwords in real time' },
    ],
  },
  {
    id: 13, section: 'container',
    text: 'Which underlying Linux kernel mechanisms serve as the primary foundation for container process isolation and resource limits?',
    options: [
      { id:'A', text:'AppArmor and Mandatory Access Controls' },
      { id:'B', text:'Namespaces and control groups (cgroups)', correct: true },
      { id:'C', text:'IPTables and Netfilter hooks' },
      { id:'D', text:'SELinux policy definitions' },
    ],
  },
  {
    id: 14, section: 'container',
    text: 'Assigning the Linux capability CAP_NET_ADMIN to a container grants container processes permission to perform which actions?',
    options: [
      { id:'A', text:'Modifying root privileges on binary files' },
      { id:'B', text:'Reconfiguring network parameters, interface settings, and packet capturing routines', correct: true },
      { id:'C', text:'Attaching hardware processing devices' },
      { id:'D', text:'Binding kernel storage partitions' },
    ],
  },
  {
    id: 15, section: 'container',
    text: 'What major security exposure is introduced by defining volumes: - /:/host inside a docker-compose.yml configuration?',
    options: [
      { id:'A', text:'It binds container ports directly to remote interface traffic' },
      { id:'B', text:'It exposes the host system’s entire root file system to read and write actions from within the container', correct: true },
      { id:'C', text:'It bypasses internal DNS lookups' },
      { id:'D', text:'It exposes container network traffic to external packet analyzers' },
    ],
  },
  {
    id: 16, section: 'container',
    text: 'In Docker Compose, what is the best syntax pattern for adhering to principle of least privilege regarding Linux capabilities?',
    options: [
      { id:'A', text:'privileged: false' },
      { id:'B', text:'Using cap_drop: [ALL] and selectively appending needed capabilities with cap_add', correct: true },
      { id:'C', text:'security_opt: [no-new-privileges:true]' },
      { id:'D', text:'read_only: true' },
    ],
  },
  {
    id: 17, section: 'container',
    text: 'To minimize operational risks inside production container workloads, how should process execution identities be defined inside a Dockerfile?',
    options: [
      { id:'A', text:'Defaulting to UID 0 (root) for maximum execution privileges' },
      { id:'B', text:'Specifying a dedicated non-root user account using the USER instruction', correct: true },
      { id:'C', text:'Enabling runtime flags like --privileged' },
      { id:'D', text:'Linking host system account files directly' },
    ],
  },
  {
    id: 18, section: 'container',
    text: 'During initial post-exploitation of a containerized application, an attacker runs find / -name docker.sock. What goal are they trying to achieve?',
    options: [
      { id:'A', text:'Locating database connection configurations' },
      { id:'B', text:'Identifying access to the host Docker daemon socket to escalate to the host system', correct: true },
      { id:'C', text:'Locating container startup script logs' },
      { id:'D', text:'Finding secret tokens stored in system environment variables' },
    ],
  },
  {
    id: 19, section: 'container',
    text: 'Which statement accurately describes a "container escape"?',
    options: [
      { id:'A', text:'A method for isolating network segments within virtual networks' },
      { id:'B', text:'Bypassing container runtime containment to execute commands directly on the underlying host OS', correct: true },
      { id:'C', text:'Removing an active image runtime instance using the CLI' },
      { id:'D', text:'Exporting active container files into a local backup tarball' },
    ],
  },
  {
    id: 20, section: 'container',
    text: 'What benefit does isolating microservices into distinct Docker Compose custom networks provide?',
    options: [
      { id:'A', text:'It halts all internal inter-container network operations' },
      { id:'B', text:'It restricts inter-service traffic to defined channels, reducing lateral movement if a container is compromised', correct: true },
      { id:'C', text:'It automatically encrypts payload traffic between services' },
      { id:'D', text:'It restricts containers from making external internet calls' },
    ],
  },
  {
    id: 21, section: 'container',
    text: 'A Linux executable binary owned by root has permissions set to -rwsr-xr-x (SUID enabled). What inherent security risk does this introduce?',
    options: [
      { id:'A', text:'It drops privileges to the calling low-privileged user account' },
      { id:'B', text:'It runs under the context of the file owner (root), potentially allowing a low-privileged caller to achieve root execution', correct: true },
      { id:'C', text:'Low-privileged accounts are blocked from invoking SUID binaries' },
      { id:'D', text:'SUID flags are ignored unless applied to shell scripts' },
    ],
  },
  {
    id: 22, section: 'container',
    text: 'Which command allows an attacker on a Linux system to discover binaries with the SUID bit set while suppressing error outputs?',
    options: [
      { id:'A', text:'find / -type f -name "*.suid"' },
      { id:'B', text:'find / -perm -4000 2>/dev/null', correct: true },
      { id:'C', text:'ls -laR / | grep root' },
      { id:'D', text:'chmod -R 4000 /' },
    ],
  },
  {
    id: 23, section: 'container',
    text: 'An audit reveals an unnecessary SUID privilege set on a custom utility binary in production. What is the standard security remediation step?',
    options: [
      { id:'A', text:'Strip the SUID permission bit or delete the file in accordance with least privilege', correct: true },
      { id:'B', text:'Transfer ownership to a standard system account while preserving SUID' },
      { id:'C', text:'Restrict permissions using chmod 444' },
      { id:'D', text:'Move the binary into /root directory pathing' },
    ],
  },


  {
    id: 24, section: 'cloud',
    text: 'Why is the AWS EC2 Instance Metadata Service (IMDS) at IP 169.254.169.254 frequently targeted by attackers?',
    options: [
      { id:'A', text:'It acts as the primary log aggregation engine for CloudWatch' },
      { id:'B', text:'It provides an unauthenticated internal endpoint supplying instance details and attached IAM credentials', correct: true },
      { id:'C', text:'It manages server volume disk encryption keys' },
      { id:'D', text:'It controls network firewall rules for security groups' },
    ],
  },
  {
    id: 25, section: 'cloud',
    text: "If an IAM policy attached to an EC2 instance contains Effect: Allow, Action: *, Resource: *, what access rights are granted to that instance?",
    options: [
      { id:'A', text:'Read-only queries to target S3 storage buckets' },
      { id:'B', text:'Zero permissions across AWS services' },
      { id:'C', text:'Unrestricted administrative access to every action on all resources in the AWS account', correct: true },
      { id:'D', text:'Access limited strictly to local VPC resources' },
    ],
  },
  {
    id: 26, section: 'cloud',
    text: 'What operational access level does an S3 Bucket Policy with Principal: *, Effect: Allow, Action: s3:GetObject grant?',
    options: [
      { id:'A', text:'Access restricted to authenticated domain identities' },
      { id:'B', text:'Anonymous public read access over the internet to all objects in the bucket', correct: true },
      { id:'C', text:'Read privileges restricted solely to the AWS account owner' },
      { id:'D', text:'Automatic server-side data encryption' },
    ],
  },
  {
    id: 27, section: 'cloud',
    text: 'What key security mechanism makes AWS IMDSv2 significantly more secure than IMDSv1 against SSRF exploitation?',
    options: [
      { id:'A', text:'IMDSv2 processes HTTP GET requests faster' },
      { id:'B', text:'IMDSv2 requires initiating a session token via a PUT request header, blocking basic SSRF vectors', correct: true },
      { id:'C', text:'IMDSv2 automatically encrypts all HTTP body responses' },
      { id:'D', text:'IMDSv2 requires explicit AWS Root account log-in' },
    ],
  },
  {
    id: 28, section: 'cloud',
    text: 'If an adversary obtains temporary credentials (AccessKeyId, SecretAccessKey, and SessionToken) via an EC2 metadata endpoint, how can they utilize them?',
    options: [
      { id:'A', text:'They cannot use them outside the host machine' },
      { id:'B', text:'They can configure them in the AWS CLI or SDKs to execute actions permitted by the associated IAM role', correct: true },
      { id:'C', text:'They are restricted strictly to listing S3 bucket contents' },
      { id:'D', text:'They expire instantly upon generation' },
    ],
  },
  {
    id: 29, section: 'cloud',
    text: 'Which sequence of AWS CLI calls allows an attacker to evaluate the identity and effective permissions of compromised credentials?',
    options: [
      { id:'A', text:'aws ec2 describe-instances' },
      { id:'B', text:'aws iam list-roles' },
      { id:'C', text:'aws sts get-caller-identity followed by policy evaluation tools like aws iam simulate-principal-policy', correct: true },
      { id:'D', text:'aws cloudtrail lookup-events' },
    ],
  },
  {
    id: 30, section: 'cloud',
    text: 'How is the principle of least privilege accurately implemented within AWS Identity and Access Management (IAM)?',
    options: [
      { id:'A', text:'Applying AdministratorAccess widely to prevent deployment errors' },
      { id:'B', text:'Restricting permissions for identities to only the specific actions and resources necessary for their operational role', correct: true },
      { id:'C', text:'Configuring S3 storage buckets to be accessible publicly' },
      { id:'D', text:'Completely eliminating IAM roles on compute instances' },
    ],
  },
  {
    id: 31, section: 'cloud',
    text: 'An attacker uses compromised credentials to execute: aws s3 ls s3://company-backups --no-sign-request. What activity are they performing?',
    options: [
      { id:'A', text:'Deleting objects from the target bucket' },
      { id:'B', text:'Listing bucket contents to locate confidential files for potential data exfiltration', correct: true },
      { id:'C', text:'Provisioning a new bucket resource' },
      { id:'D', text:'Reconfiguring S3 access control lists' },
    ],
  },
  {
    id: 32, section: 'cloud',
    text: 'Which AWS service is designed for central storage and rotation of database credentials and API keys, making it a key target during IAM misconfiguration exploits?',
    options: [
      { id:'A', text:'AWS CloudTrail' },
      { id:'B', text:'AWS Secrets Manager', correct: true },
      { id:'C', text:'AWS Config' },
      { id:'D', text:'AWS Inspector' },
    ],
  },
  {
    id: 33, section: 'cloud',
    text: 'What control provides the most effective mitigation against SSRF attacks seeking to steal credentials from the EC2 Instance Metadata Service?',
    options: [
      { id:'A', text:'Blocking all outgoing traffic from the EC2 instance' },
      { id:'B', text:'Enforcing IMDSv2 requiring session tokens and setting hop-limits or restricting instance metadata access', correct: true },
      { id:'C', text:'Deleting the EC2 instance profile' },
      { id:'D', text:'Placing the instance behind an internal load balancer' },
    ],
  },
];