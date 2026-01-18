# 개발 가이드

## 개발 환경 설정

### 필수 도구

- **Node.js**: 18.0.0 이상
- **npm**: 8.0.0 이상
- **AWS CLI**: 2.0 이상
- **AWS CDK CLI**: 2.100.0 이상
- **TypeScript**: 5.9.3
- **Git**: 2.30 이상

### 개발 도구 설치

```bash
# Node.js 버전 확인
node --version  # v18.0.0+

# AWS CLI 설치 및 구성
aws --version
aws configure

# CDK CLI 설치
npm install -g aws-cdk
cdk --version

# TypeScript 컴파일러 확인
npx tsc --version
```

### 환경 변수

프로젝트에서 사용하는 주요 환경 변수:

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `AWS_REGION` | 배포할 AWS 리전 | `us-east-1` |
| `AWS_ACCOUNT_ID` | AWS 계정 ID | `123456789012` |
| `CDK_DEFAULT_ACCOUNT` | CDK 기본 계정 | `123456789012` |
| `CDK_DEFAULT_REGION` | CDK 기본 리전 | `us-east-1` |

## 코드 컨벤션

### 네이밍

- **파일명**: kebab-case (`valkey-migration-stack.ts`)
- **클래스명**: PascalCase (`ValkeyMigrationStack`)
- **변수명**: camelCase (`redisInstance`)
- **상수명**: UPPER_SNAKE_CASE (`DEFAULT_PORT`)
- **리소스 ID**: PascalCase with prefix (`ValkeyMigrationVpc`)

### TypeScript 스타일

```typescript
// ✅ 좋은 예
export class ValkeyMigrationStack extends cdk.Stack {
  private readonly vpc: ec2.Vpc;
  
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // 명확한 변수명과 주석
    this.vpc = this.createVpc();
  }
  
  private createVpc(): ec2.Vpc {
    return new ec2.Vpc(this, 'ValkeyMigrationVpc', {
      maxAzs: 2,
      natGateways: 1,
    });
  }
}

// ❌ 나쁜 예
export class Stack1 extends cdk.Stack {
  constructor(scope: any, id: any, props: any) {
    super(scope, id, props);
    
    let v = new ec2.Vpc(this, 'vpc1', { maxAzs: 2 });
  }
}
```

### 디렉토리 구조

```
valkey-migration/
├── bin/                    # CDK 앱 진입점
│   └── valkey-migration.ts
├── lib/                    # CDK 스택 구현
│   └── valkey-migration-stack.ts
├── test/                   # 단위 테스트
│   └── valkey-migration.test.ts
├── docs/                   # 프로젝트 문서
│   ├── architecture.md
│   ├── migration-guide.md
│   ├── development.md
│   └── progress.md
├── scripts/                # 유틸리티 스크립트
│   ├── deploy.sh
│   └── cleanup.sh
├── package.json            # 프로젝트 의존성
├── tsconfig.json           # TypeScript 구성
├── cdk.json               # CDK 구성
├── jest.config.js         # Jest 테스트 구성
└── README.md              # 프로젝트 개요
```

## 로컬 개발

### 프로젝트 설정

```bash
# 저장소 클론
git clone <repository-url>
cd valkey-migration

# 의존성 설치
npm install

# TypeScript 컴파일
npm run build

# 변경 사항 감시 (개발 중)
npm run watch
```

### CDK 개발 워크플로우

```bash
# 1. 코드 변경 후 컴파일
npm run build

# 2. 구문 검사 및 CloudFormation 템플릿 생성
npx cdk synth

# 3. 변경 사항 확인
npx cdk diff

# 4. 배포 (개발 환경)
npx cdk deploy

# 5. 테스트 실행
npm test

# 6. 정리
npx cdk destroy
```

### 개발 서버 실행

```bash
# TypeScript 컴파일 감시 모드
npm run watch

# 별도 터미널에서 CDK 명령 실행
npx cdk synth --watch
```

## 테스트

### 단위 테스트 실행

```bash
# 모든 테스트 실행
npm test

# 특정 테스트 파일 실행
npm test -- valkey-migration.test.ts

# 커버리지 포함 테스트
npm test -- --coverage

# 감시 모드로 테스트
npm test -- --watch
```

### 테스트 작성 가이드

```typescript
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ValkeyMigrationStack } from '../lib/valkey-migration-stack';

describe('ValkeyMigrationStack', () => {
  test('VPC가 올바르게 생성되는지 확인', () => {
    const app = new cdk.App();
    const stack = new ValkeyMigrationStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    // VPC 리소스 존재 확인
    template.hasResourceProperties('AWS::EC2::VPC', {
      CidrBlock: '10.0.0.0/16'
    });
  });

  test('ElastiCache 클러스터 구성 확인', () => {
    const app = new cdk.App();
    const stack = new ValkeyMigrationStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    // ElastiCache 리소스 확인
    template.hasResourceProperties('AWS::ElastiCache::ReplicationGroup', {
      Engine: 'valkey',
      EngineVersion: '8.0'
    });
  });
});
```

### 통합 테스트

```bash
# 실제 AWS 환경에서 테스트
./scripts/integration-test.sh

# 테스트 환경 정리
./scripts/cleanup-test.sh
```

## 배포

### 개발 환경 배포

```bash
# CDK 부트스트랩 (최초 1회)
npx cdk bootstrap

# 개발 스택 배포
npx cdk deploy --profile dev

# 특정 리전에 배포
npx cdk deploy --profile dev --region us-west-2
```

### 프로덕션 배포

```bash
# 프로덕션 구성으로 배포
npx cdk deploy --profile prod --require-approval never

# 배포 전 변경 사항 검토
npx cdk diff --profile prod
```

### 배포 스크립트

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=${1:-dev}
REGION=${2:-us-east-1}

echo "배포 환경: $ENVIRONMENT"
echo "리전: $REGION"

# 빌드
npm run build

# 테스트
npm test

# 배포
npx cdk deploy \
  --profile $ENVIRONMENT \
  --region $REGION \
  --require-approval never

echo "배포 완료!"
```

## 디버깅

### CDK 디버깅

```bash
# 상세한 로그 출력
npx cdk deploy --verbose

# CloudFormation 이벤트 확인
npx cdk deploy --events

# 스택 상태 확인
aws cloudformation describe-stacks --stack-name ValkeyMigrationStack
```

### 리소스 디버깅

```bash
# EC2 인스턴스 상태 확인
aws ec2 describe-instances --filters "Name=tag:aws:cloudformation:stack-name,Values=ValkeyMigrationStack"

# ElastiCache 클러스터 상태 확인
aws elasticache describe-replication-groups

# 보안 그룹 규칙 확인
aws ec2 describe-security-groups --group-names "ValkeyMigrationStack*"
```

### 로그 확인

```bash
# CloudFormation 스택 이벤트
aws cloudformation describe-stack-events --stack-name ValkeyMigrationStack

# CloudWatch 로그
aws logs describe-log-groups --log-group-name-prefix "/aws/elasticache"

# EC2 인스턴스 로그 (SSH 접속 후)
sudo tail -f /var/log/cloud-init-output.log
sudo tail -f /var/log/redis.log
```

## 성능 최적화

### CDK 성능

```typescript
// 리소스 재사용
const vpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', {
  vpcId: 'vpc-12345678'
});

// 조건부 리소스 생성
if (props.enableNatGateway) {
  new ec2.NatGateway(this, 'NatGateway', {
    subnet: vpc.publicSubnets[0]
  });
}
```

### 빌드 성능

```json
// tsconfig.json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo"
  },
  "exclude": [
    "node_modules",
    "cdk.out"
  ]
}
```

## 보안 고려사항

### 코드 보안

```typescript
// ✅ 보안 모범 사례
const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
  vpc,
  description: 'Security group for Redis',
  allowAllOutbound: false  // 명시적으로 아웃바운드 제한
});

// 특정 포트만 허용
securityGroup.addIngressRule(
  ec2.Peer.securityGroupId(valkeySecurityGroup.securityGroupId),
  ec2.Port.tcp(6379),
  'Allow ElastiCache to connect to Redis'
);
```

### 시크릿 관리

```typescript
// AWS Secrets Manager 사용
const secret = new secretsmanager.Secret(this, 'RedisPassword', {
  generateSecretString: {
    excludeCharacters: '"@/\\'
  }
});
```

### IAM 권한

```typescript
// 최소 권한 원칙
const role = new iam.Role(this, 'EC2Role', {
  assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
  managedPolicies: [
    iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
  ]
});
```

## 문제 해결

### 일반적인 개발 문제

#### 1. TypeScript 컴파일 오류

```bash
# 타입 정의 재설치
rm -rf node_modules package-lock.json
npm install

# TypeScript 캐시 정리
rm -rf .tsbuildinfo
npm run build
```

#### 2. CDK 배포 실패

```bash
# CDK 상태 확인
npx cdk doctor

# CloudFormation 스택 상태 확인
aws cloudformation describe-stacks --stack-name ValkeyMigrationStack

# 강제 재배포
npx cdk deploy --force
```

#### 3. 리소스 생성 실패

```bash
# 리소스 한도 확인
aws service-quotas get-service-quota \
  --service-code ec2 \
  --quota-code L-1216C47A  # Running On-Demand t3 instances

# 리전별 가용 영역 확인
aws ec2 describe-availability-zones --region us-east-1
```

### 로그 분석

```bash
# CDK 배포 로그
npx cdk deploy 2>&1 | tee deploy.log

# CloudFormation 이벤트 필터링
aws cloudformation describe-stack-events \
  --stack-name ValkeyMigrationStack \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

## 기여 가이드

### 코드 기여

1. **포크 및 브랜치 생성**
```bash
git checkout -b feature/new-feature
```

2. **코드 작성 및 테스트**
```bash
npm run build
npm test
```

3. **커밋 메시지 규칙**
```bash
git commit -m "feat: ElastiCache 암호화 옵션 추가"
git commit -m "fix: 보안 그룹 규칙 수정"
git commit -m "docs: 마이그레이션 가이드 업데이트"
```

4. **풀 리퀘스트 생성**
- 변경 사항 설명
- 테스트 결과 포함
- 문서 업데이트 확인

### 문서 기여

```bash
# 문서 변경 후 확인
npm run build
# 문서 링크 및 형식 검증
```

## 릴리스 관리

### 버전 관리

```bash
# 버전 업데이트
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
```

### 릴리스 노트

```markdown
## v1.1.0 (2025-01-16)

### 새로운 기능
- ElastiCache 암호화 옵션 추가
- 다중 리전 배포 지원

### 버그 수정
- 보안 그룹 규칙 오류 수정
- Redis 구성 파일 경로 문제 해결

### 문서 개선
- 마이그레이션 가이드 상세화
- 문제 해결 섹션 추가
```

## 모니터링 및 알림

### CloudWatch 대시보드

```typescript
const dashboard = new cloudwatch.Dashboard(this, 'MigrationDashboard', {
  dashboardName: 'valkey-migration-monitoring'
});

dashboard.addWidgets(
  new cloudwatch.GraphWidget({
    title: 'ElastiCache CPU Utilization',
    left: [valkeyCluster.metricCPUUtilization()]
  })
);
```

### 알림 설정

```typescript
const alarm = new cloudwatch.Alarm(this, 'HighCPUAlarm', {
  metric: valkeyCluster.metricCPUUtilization(),
  threshold: 80,
  evaluationPeriods: 2
});

alarm.addAlarmAction(
  new cloudwatchActions.SnsAction(snsTopic)
);
```

이 개발 가이드를 통해 프로젝트를 효율적으로 개발하고 유지보수할 수 있습니다. 추가 질문이나 개선 사항이 있으면 언제든지 문의해 주세요.