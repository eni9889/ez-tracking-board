import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export class LoadBalancerStack {
  public alb: aws.lb.LoadBalancer;
  public listener: aws.lb.Listener;
  public albUrl: pulumi.Output<string>;

  constructor(
    name: string,
    vpcId: pulumi.Output<string>,
    publicSubnetIds: pulumi.Output<string>[],
    securityGroupId: pulumi.Output<string>,
    targetGroupArn: pulumi.Output<string>
  ) {
    // Create Application Load Balancer
    this.alb = new aws.lb.LoadBalancer(`${name}-alb`, {
      name: `${name}-alb`,
      loadBalancerType: "application",
      internal: false,
      securityGroups: [securityGroupId],
      subnets: publicSubnetIds,
      enableDeletionProtection: false,
      enableHttp2: true,
      idleTimeout: 60,
      tags: {
        Name: `${name}-alb`,
        Environment: pulumi.getStack(),
      },
    });

    // Create HTTP listener (will redirect to HTTPS when certificate is added)
    this.listener = new aws.lb.Listener(`${name}-alb-listener`, {
      loadBalancerArn: this.alb.arn,
      port: 80,
      protocol: "HTTP",
      defaultActions: [{
        type: "forward",
        targetGroupArn: targetGroupArn,
      }],
      tags: {
        Name: `${name}-alb-listener`,
        Environment: pulumi.getStack(),
      },
    });

    this.albUrl = pulumi.interpolate`http://${this.alb.dnsName}`;
  }

  // Create HTTPS listener when certificate is available
  createHttpsListener(
    name: string,
    certificateArn: string,
    targetGroupArn: pulumi.Output<string>
  ): aws.lb.Listener {
    return new aws.lb.Listener(`${name}-alb-https-listener`, {
      loadBalancerArn: this.alb.arn,
      port: 443,
      protocol: "HTTPS",
      sslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06",
      certificateArn: certificateArn,
      defaultActions: [{
        type: "forward",
        targetGroupArn: targetGroupArn,
      }],
      tags: {
        Name: `${name}-alb-https-listener`,
        Environment: pulumi.getStack(),
      },
    });
  }

  // Update HTTP listener to redirect to HTTPS
  updateHttpListenerToRedirect(name: string): void {
    // This would be implemented when HTTPS is set up
    // For now, we'll keep HTTP listener as is
  }
} 