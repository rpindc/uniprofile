# UniProfile security posture — as of 2026-05-13

## Summary

UniProfile's AWS environment has a reasonable foundation: no IAM users (role-only access), encrypted storage throughout, secrets in Secrets Manager rather than plaintext, and both Lambdas properly referencing secrets via ARN. However, three gaps stand out before the second real user is onboarded: the root account has active access keys that bypass all IAM controls; CloudTrail is not enabled so there is no audit record of any AWS API call made to date; and GuardDuty is off so active threats would go undetected. MFA is disabled at the Cognito User Pool level, meaning all current user accounts (including both Rommel accounts and Sheral) authenticate with password only. The overall posture is "functional but unwatched" — the app works correctly but the account lacks the monitoring layer that would detect a compromise in progress.

---

## Findings by area

### 1. Root account

- **Status: Risk**
- **Details:**
  - MFA enabled on root account ✓
  - Root account has **active access keys** (`AccessKeysPresent: 1`) — this is the single highest-severity finding in the audit. Root access keys bypass all IAM policies and cannot be scoped or revoked without deleting them. They represent permanent, unrestricted access to the entire AWS account.
  - CloudTrail is not enabled (see §8), so root account last-login date cannot be retrieved from this audit. Historical activity is unknown.
  - Root account email is a personal address (rommel@uniworldinc.com); no controlled distribution list or alias in use.
- **Recommended actions:**
  - [H] Delete the root account access keys immediately. There is no legitimate use case for root access keys; all programmatic access should go through IAM roles.
  - [M] Change root account email to a distribution list or alias (e.g., aws-root@uniprofile.net) that more than one person can access.
  - [L] Document a break-glass procedure for root account usage — when it's acceptable to log in, who must approve it, and what steps to take afterward.

---

### 2. IAM users and roles

- **Status: Mostly good / one item needs attention**
- **Details:**
  - **No IAM users exist** — all access is via IAM roles. This is correct practice. ✓
  - **Active application roles:**
    - `UniProfileApi-UniProfileHandlerServiceRole996FDADD-Kk7safhwTPAh` — Lambda execution role for both `uniprofile-api` and `uniprofile-email-parser`. Last used: 2026-05-14. Permissions via 8 inline policies + 2 managed policies (AWSLambdaBasicExecutionRole, AWSLambdaVPCAccessExecutionRole). Trust: lambda.amazonaws.com only. ✓
    - `UniProfileApi-UniProfileApiCloudWatchRoleADDFC8CB-qX5pQqgj6nDy` — API Gateway CloudWatch logging role. Not checked in detail (standard pattern).
  - **CDK roles (4 roles: cfn-exec, deploy, file-publishing, lookup):** Created 2026-03-31. The `cdk-hnb659fds-cfn-exec-role-688414611728-us-east-1` has **`AdministratorAccess`** attached — this is standard CDK behavior but means anyone or any process that can assume this role and trigger a CloudFormation stack update has full account access.
  - **Stale role:** `aws-codestar-service-role` created 2018-10-25, `RoleLastUsed: null` — never used. Candidate for removal.
  - **`AllowAdminGetUserForBug1Fix`** — inline policy on the Lambda role granting `cognito-idp:AdminGetUser` on the UniProfile user pool. The permission is narrow and functionally appropriate (Lambda needs to look up users by attribute). The name signals it was added as a one-off fix and never formally absorbed into the CDK stack definition. Low risk, but worth cleaning up.
  - No role has `PowerUserAccess`. CDK cfn-exec has `AdministratorAccess` (flagged above).
  - No role unused for 90+ days among application roles (stale CDK bootstrap roles predate the app by definition and aren't actively harmful).
- **Recommended actions:**
  - [H] Review whether CDK `cfn-exec` role scope can be tightened to only the specific services UniProfile uses (RDS, Lambda, API Gateway, Cognito, S3, Secrets Manager, KMS) rather than full AdministratorAccess. This is a CDK bootstrap configuration change.
  - [L] Delete or disable `aws-codestar-service-role` — it has no purpose in this account.
  - [L] Move `AllowAdminGetUserForBug1Fix` permission into the main CDK stack definition so it's tracked in version control; rename to reflect its purpose.

---

### 3. Cognito User Pool (`us-east-1_OqNHNEWZP`)

- **Status: Needs attention**
- **Details:**
  - **MFA:** `OFF` at pool level — no user has MFA, no MFA is enforced or even offered at signup. Confirmed on all 3 user accounts (MFAOptions: null).
  - **Users (3 total, confirmed):**
    1. Rommel Patel — rommel@uniworldinc.com — CONFIRMED, Enabled
    2. Sheral Patel — sheral.patel2000@gmail.com — CONFIRMED, Enabled (no family_name/given_name attributes set)
    3. Rommel Patel — rommelpatel@hotmail.com — CONFIRMED, Enabled
  - **Password policy:** Minimum 8 characters, requires uppercase + lowercase + numbers + symbols. ✓
  - **Account recovery:** Verified phone (priority 1), verified email (priority 2). Phone is the primary recovery method but phone number is not required or verified at signup — in practice, email recovery is what users will fall back to. Slightly misleading priority ordering.
  - **`AttributesRequireVerificationBeforeUpdate: []`** — if a user changes their email address via the API, the change takes effect immediately without re-verification. A compromised session could change the account email to an attacker-controlled address, locking out the real user. Medium account-takeover risk.
  - **Token expiry:** All null (using Cognito defaults): access token 1 hour, ID token 1 hour, refresh token 30 days. Defaults are acceptable.
  - **Account lockout:** Cognito implements adaptive authentication internally (challenge-based). No custom lockout policy. Acceptable at this stage.
  - **Email sending:** `COGNITO_DEFAULT` — limited to 50 emails/day from Cognito's shared pool. Adequate for current user count; will become a bottleneck during growth.
  - **Deletion protection:** INACTIVE — the user pool can be deleted without an additional confirmation. Low risk for now.
- **Recommended actions:**
  - [H] Enable MFA — at minimum, set `MfaConfiguration: OPTIONAL` so users can opt in. For admin-tier accounts, enforce it. Losing an unprotected account = losing a real user's travel history.
  - [M] Set `AttributesRequireVerificationBeforeUpdate: [email]` so email changes require the new address to be confirmed before they take effect.
  - [M] Switch email sending to SES with a verified sending identity (uniprofile.net domain) — removes the 50/day cap and improves deliverability.
  - [L] Enable deletion protection on the user pool.
  - [L] Clarify account recovery order — either require phone at signup or reorder recovery to email-first.

---

### 4. Aurora PostgreSQL

- **Status: Good / two gaps**
- **Details:**
  - **Cluster:** `uniprofiledatabase-uniprofilecluster699d0a9d-a0kj5uzcmhup`
  - **Encryption at rest:** Enabled, KMS key `ef9438c4` (`alias/aws/rds`). ✓
  - **Network:** In a VPC with a dedicated subnet group. `PubliclyAccessible: null` (not public). ✓
  - **Backup retention:** **1 day** — the minimum. If data corruption is discovered 25 hours after it happened, there is no recovery path.
  - **Point-in-time recovery:** Enabled as part of Aurora (PITR is always on for Aurora). ✓ — but the PITR window is constrained by the 1-day backup retention.
  - **Deletion protection:** `false` — the cluster can be deleted by anyone with sufficient IAM permissions without an extra confirmation.
  - **IAM database authentication:** Disabled. DB access is via Secrets Manager credentials (the Lambda fetches the secret at runtime). This is an acceptable pattern. ✓
  - **Multi-AZ:** `false` — single AZ. This means a single-AZ failure takes down the database. Acceptable cost tradeoff for pre-GA but worth revisiting before significant user growth.
  - **Database users/privileges:** Not directly audited (requires a database-level query). DB credentials are stored in Secrets Manager (`/uniprofile/db/credentials`). ✓
  - **Secrets Manager — DB credentials:** `RotationEnabled: null`, `LastRotatedDate: null` — **automatic rotation is not configured**. The DB password was set 2026-03-31 and has not changed since. Same applies to all 4 secrets in the account (Timatic, Anthropic key, and a second RDS auto-generated secret).
- **Recommended actions:**
  - [H] Enable automatic rotation on `/uniprofile/db/credentials` (Secrets Manager built-in rotation for Aurora is free and zero-downtime).
  - [M] Increase backup retention to at least 7 days (30 days preferred for a production user database).
  - [M] Enable deletion protection on the Aurora cluster.
  - [L] Enable Multi-AZ when preparing for a second real user cohort (cost: ~2× instance price, but eliminates single-AZ outage risk).

---

### 5. API Gateway and Lambda

- **Status: Needs attention**
- **Details:**
  - **API Gateway:** `UniProfileAPI` (`0wsxmo9ftg`), regional endpoint.
    - **No Cognito authorizer configured at the gateway level** (`authorizationType: NONE` confirmed on `GET /api/v1/me`). Authentication is enforced inside the Lambda handler — the JWT token is validated in application code, not at the gateway. This means a misconfigured route or a Lambda code bug could inadvertently expose data. Gateway-level authorization is a defense-in-depth layer that is missing.
    - **TLS policy: `TLS_1_0`** — the API accepts connections over TLS 1.0, which has known weaknesses (POODLE, BEAST). Should be `TLS_1_2` minimum.
    - **`disableExecuteApiEndpoint: false`** — the default `https://0wsxmo9ftg.execute-api.us-east-1.amazonaws.com/prod/` URL is accessible in addition to any custom domain. This can be tightened.
    - **Routes include** `/v1/payment`, `/v1/loyalty`, `/v1/biometrics`, `/v1/health` — these appear to be placeholder or future routes (ANY method). Verify these are handled correctly by the Lambda (not accidentally serving data if hit).
  - **Lambda `uniprofile-api`:**
    - Execution role: shared with email-parser (see below).
    - VPC: yes — deployed into `vpc-07b6aa97759f2bf8b`, 2 subnets, security group `sg-09f348882864849e7`. ✓
    - Environment variables: all secrets referenced via ARN (no plaintext). ✓
  - **Lambda `uniprofile-email-parser`:**
    - Execution role: **same role as `uniprofile-api`** — email-parser inherits all API permissions (SES send, Cognito AdminGetUser, Timatic credentials, etc.) that it does not need. Violates least privilege.
    - **VPC: none** — email-parser is not in the VPC. It accesses Aurora via the RDS Data API (which does not require VPC placement), so this works, but best practice is VPC placement to limit network exposure.
    - Environment variables: no plaintext secrets. ✓
  - **Lambda function URLs:** None configured on either function. ✓
- **Recommended actions:**
  - [H] Configure a Cognito User Pool authorizer on API Gateway and attach it to all protected routes, removing the NONE authorization type. This adds a hard gateway-level block before any Lambda code runs.
  - [M] Change API Gateway TLS policy from `TLS_1_0` to `TLS_1_2`.
  - [M] Create a separate IAM role for `uniprofile-email-parser` with only the permissions it needs (S3 read from email-vault, RDS Data API, Secrets Manager for DB credentials, Anthropic secret). Remove all SES, Cognito, Timatic permissions from that role.
  - [L] Set `disableExecuteApiEndpoint: true` once a custom domain is confirmed as the sole access path.
  - [L] Deploy `uniprofile-email-parser` into the VPC.

---

### 6. S3 buckets

- **Status: Mostly good / one item to confirm**
- **Details:**

  | Bucket | Public Access Block | Encryption | Versioning | Bucket Policy | Access Logging |
  |---|---|---|---|---|---|
  | `uniprofile-email-vault` | All 4 settings: true ✓ | AES-256 ✓ | Disabled ⚠️ | SES puts only ✓ | Not configured |
  | `uniprofile.net` | All 4 settings: false | AES-256 ✓ | Disabled | `s3:GetObject` for `*` (intentional — static site) | Not configured |
  | `cdk-hnb659fds-assets-...` | All 4 settings: true ✓ | KMS ✓ | Enabled ✓ | N/A | Not configured |

  - `uniprofile-email-vault` stores forwarded emails which may contain personal data (names, booking references, passport numbers embedded in itineraries). Versioning is off — accidental deletion of an email object is unrecoverable.
  - `uniprofile.net` is the static website bucket; public read via bucket policy is intentional and expected. The public access block settings being off is the correct configuration for a website bucket served directly from S3. ✓
  - No passport scan documents were found stored in S3 (expected — documents processed via Lambda → Aurora, not persisted in S3).
  - Access logging is not configured on any bucket. If an object in `email-vault` were accessed inappropriately, there would be no record of it.

- **Recommended actions:**
  - [M] Enable versioning on `uniprofile-email-vault` to allow recovery of accidentally overwritten or deleted email objects.
  - [L] Enable S3 access logging on `uniprofile-email-vault` (log to a separate logging bucket). Given it stores personal email data, an access trail is worth having.

---

### 7. KMS keys

- **Status: Good (with one structural note)**
- **Details:**
  - 7 keys in the account; all are **AWS-managed keys** (aliases in `alias/aws/` namespace). No customer-managed CMKs exist.
  - Keys in active use:
    - `alias/aws/rds` (`ef9438c4`) — encrypts Aurora cluster. Rotation: enabled, annual, next rotation 2027-03-31. ✓
    - `alias/aws/secretsmanager` (`91760569`) — encrypts secrets in Secrets Manager. Rotation: enabled, annual. ✓
    - `alias/aws/s3` (`e24b07a7`) — available for S3 KMS encryption (email-vault uses AES-256 SSE-S3 rather than this key).
    - `alias/aws/lambda` (`e7b6d397`) — available for Lambda environment variable encryption.
    - `alias/aws/acm` (`adf735db`) — ACM certificate key.
    - `alias/aws/lightsail` (`10242f92`) — exists from 2018 Lightsail usage, not relevant to current stack.
  - AWS-managed keys are automatically rotated by AWS annually. The trade-off: key policies cannot be customized (only AWS service permissions apply), and there is less audit visibility compared to customer-managed CMKs.
  - No keys are pending deletion or disabled. ✓
- **Recommended actions:**
  - [L] Consider creating customer-managed CMKs for Aurora and Secrets Manager to enable custom key policies (e.g., restrict which Lambda roles can decrypt) and more granular CloudTrail-level audit when CloudTrail is enabled. Not urgent at current scale — AWS-managed keys are secure.

---

### 8. CloudTrail, CloudWatch, GuardDuty

- **Status: Risk**
- **Details:**
  - **CloudTrail: NOT ENABLED** — `trailList: []`. No API call made to this AWS account has been logged since the account was created. There is no record of who created what, when, or from where. If the root access keys (see §1) have been used, there is no way to know. This is the foundational monitoring gap.
  - **GuardDuty: NOT ENABLED** — `DetectorIds: []`. No threat detection is in place. Unusual patterns (port scanning, credential exfiltration, cryptomining via compromised Lambda) would not be detected.
  - **AWS Security Hub: NOT SUBSCRIBED.** No aggregated security findings.
  - **AWS Config: NOT ENABLED** — no configuration change history, no compliance rules.
  - **CloudWatch log groups exist** for both Lambda functions and API Gateway, meaning application-level logs (errors, request logs) are being captured. However, **no retention policy is set on any log group** — `retentionInDays: null` on all 3 log groups. CloudWatch retains logs indefinitely by default (at ongoing cost), until explicitly deleted.
  - Because CloudTrail is off, root account last-login date could not be determined during this audit.
- **Recommended actions:**
  - [H] Enable CloudTrail — create a multi-region trail logging all management and data events, storing logs in an S3 bucket with log file validation enabled. Cost: ~$2/month for a small account.
  - [H] Enable GuardDuty — $4–$10/month at this activity level. Provides continuous threat detection with no configuration overhead.
  - [M] Set retention policies on all CloudWatch log groups. Suggested: 90 days for Lambda logs, 30 days for API Gateway access logs.
  - [M] Enable AWS Security Hub after CloudTrail and GuardDuty are running — it aggregates findings from both plus runs CIS AWS Foundations checks automatically.
  - [L] Enable AWS Config if configuration drift tracking becomes a compliance requirement. Not urgent at pre-GA stage.

---

## Top 5 recommended actions (priority order)

1. **Delete root account access keys** — Root keys bypass every IAM control in the account. There is no legitimate use for them. Deleting them takes 2 minutes in the IAM console. Estimated effort: 5 minutes.

2. **Enable CloudTrail** — There is currently zero audit record of any AWS API activity, including whether the root keys have been used. A multi-region trail costs ~$2/month and takes 10 minutes to configure. Until CloudTrail is on, the account is effectively flying blind. Estimated effort: 15 minutes.

3. **Enable GuardDuty** — Passive threat detection that runs continuously with no maintenance. Detects compromised credentials, unusual API call patterns, and known malicious IPs. $4–10/month at current scale. Estimated effort: 5 minutes (one-click enable).

4. **Enable Cognito MFA (optional for users)** — All 3 current accounts have password-only authentication. Setting MFA to OPTIONAL adds no friction for users who don't set it up, but allows security-conscious users (including Rommel's admin account) to protect themselves. Escalate to REQUIRED for admin-tier accounts when roles are differentiated. Estimated effort: 30 minutes (Cognito console + test).

5. **Add Cognito authorizer to API Gateway** — Move authentication enforcement from inside the Lambda to the API Gateway layer. This ensures no request reaches Lambda code without a valid Cognito JWT, regardless of any application-level bug. Estimated effort: 1–2 hours (CDK change + deploy + test all routes).

---

## Items requiring spend or external help

- **GuardDuty** — ~$4–10/month at current traffic volume (30-day free trial available)
- **CloudTrail** — ~$2/month for management events; data event logging adds ~$0.10/100K events
- **SES verified sending identity** (for Cognito MFA codes and verification emails beyond 50/day) — negligible cost, but requires DNS changes on uniprofile.net domain
- **Aurora Multi-AZ** — approximately 2× current Aurora instance cost. Revisit before onboarding significant user volume.
- **Secrets Manager auto-rotation** — Lambda-based rotation: ~$0.20/month per secret. Free to configure.

---

## What's NOT covered by this audit

- **Application-level security** — No review of XSS, CSRF, SQL injection, or other OWASP Top 10 vulnerabilities in the Lambda function code.
- **Code review** — Lambda function source code was not read or analyzed.
- **Penetration testing** — No attempt was made to exploit any of the identified gaps.
- **Database-level audit** — Database users, privileges, and schemas were not inspected (requires a database connection, which was not established).
- **Amplify configuration** — The Amplify hosting environment (build settings, access controls, branch-based deployments) was not reviewed.
- **Network security groups** — The security group `sg-09f348882864849e7` attached to both the Lambda and Aurora cluster was not inspected for overly permissive inbound/outbound rules.
- **Dependency scanning** — Lambda function dependencies (npm packages) were not scanned for known CVEs.
- **SOC 2 / compliance mapping** — This is a hygiene baseline, not a compliance audit.
- **Root account MFA device details** — MFA is enabled but the type of MFA device (TOTP, hardware key) was not verified.
- **SES reputation / DMARC / DKIM** — Email deliverability and anti-spoofing configuration for uniprofile.net was not audited.
