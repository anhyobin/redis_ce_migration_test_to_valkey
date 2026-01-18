import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

export class ValkeyMigrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC with 2 AZs
    const vpc = new ec2.Vpc(this, 'ValkeyMigrationVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    // Security Group for EC2 (Redis source)
    const redisSg = new ec2.SecurityGroup(this, 'RedisSg', {
      vpc,
      description: 'Security group for self-hosted Redis on EC2',
      allowAllOutbound: true,
    });

    // Security Group for ElastiCache (Valkey target)
    const valkeySg = new ec2.SecurityGroup(this, 'ValkeySg', {
      vpc,
      description: 'Security group for ElastiCache Valkey',
      allowAllOutbound: true,
    });

    // Allow ElastiCache to connect to EC2 Redis (for replication)
    redisSg.addIngressRule(valkeySg, ec2.Port.tcp(6379), 'Allow ElastiCache to replicate from Redis');
    // Allow EC2 to connect to ElastiCache (for verification)
    valkeySg.addIngressRule(redisSg, ec2.Port.tcp(6379), 'Allow EC2 to connect to ElastiCache');

    // EC2 Instance Connect Endpoint for bastion access
    new ec2.CfnInstanceConnectEndpoint(this, 'EicEndpoint', {
      subnetId: vpc.privateSubnets[0].subnetId,
      securityGroupIds: [redisSg.securityGroupId],
    });

    // User data script to install Redis 7.4.6
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'yum update -y',
      'yum install -y gcc make',
      'cd /tmp',
      'curl -O http://download.redis.io/releases/redis-7.4.6.tar.gz',
      'tar xzf redis-7.4.6.tar.gz',
      'cd redis-7.4.6',
      'make',
      'make install',
      // Configure Redis for online migration
      'mkdir -p /etc/redis',
      'cat > /etc/redis/redis.conf << EOF',
      'bind 0.0.0.0',
      'protected-mode no',
      'port 6379',
      'daemonize yes',
      'pidfile /var/run/redis_6379.pid',
      'logfile /var/log/redis.log',
      'EOF',
      '/usr/local/bin/redis-server /etc/redis/redis.conf',
    );

    // EC2 Instance with Redis 7.4.6
    const redisInstance = new ec2.Instance(this, 'RedisInstance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: redisSg,
      userData,
    });

    // ElastiCache Subnet Group
    const subnetGroup = new elasticache.CfnSubnetGroup(this, 'ValkeySubnetGroup', {
      description: 'Subnet group for ElastiCache Valkey',
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
      cacheSubnetGroupName: 'valkey-migration-subnet-group',
    });

    // ElastiCache for Valkey (cluster-mode disabled, Multi-AZ, no TLS for online migration)
    const valkeyCluster = new elasticache.CfnReplicationGroup(this, 'ValkeyCluster', {
      replicationGroupDescription: 'ElastiCache for Valkey - Migration Target',
      engine: 'valkey',
      engineVersion: '8.2',
      cacheNodeType: 'cache.t3.medium',
      numCacheClusters: 2, // Primary + 1 Replica for Multi-AZ
      automaticFailoverEnabled: true,
      multiAzEnabled: true,
      transitEncryptionEnabled: false, // Required: must be disabled for online migration
      atRestEncryptionEnabled: false,
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
      securityGroupIds: [valkeySg.securityGroupId],
      port: 6379,
    });
    valkeyCluster.addDependency(subnetGroup);

    // Outputs
    new cdk.CfnOutput(this, 'RedisInstanceId', {
      value: redisInstance.instanceId,
      description: 'EC2 Instance ID running Redis 7.4.6',
    });

    new cdk.CfnOutput(this, 'RedisPrivateIp', {
      value: redisInstance.instancePrivateIp,
      description: 'Private IP of Redis instance (use for StartMigration)',
    });

    new cdk.CfnOutput(this, 'ValkeyPrimaryEndpoint', {
      value: valkeyCluster.attrPrimaryEndPointAddress,
      description: 'ElastiCache Valkey Primary Endpoint',
    });

    new cdk.CfnOutput(this, 'ValkeyReplicationGroupId', {
      value: valkeyCluster.ref,
      description: 'Replication Group ID (use for StartMigration)',
    });
  }
}
