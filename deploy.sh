#!/usr/bin/env bash

sudo apt update

# 1. Install Docker Engine
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
# Enable docker without sudo
sudo usermod -aG docker ubuntu


# 2. Add GitHub SSH key
ssh-keygen -t ed25519 -C "kredd-deploy"
# Manually add it to the "deploy keys" section on GitHub repo. Ensure read access only.

# 3. Clone and boot servers!
cd ~
git clone git@github.com:DomHudson/kredd.git
cd kredd


# Add SWAP.
sudo swapon --show # Empty output means no swap.
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab # Ensure swap sticks around on reboot.
# Reduce SWAP aggressiveness
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf


# Install Amazon CloudWatch
# https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/manual-installation.html
# https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/download-CloudWatch-Agent-on-EC2-Instance-commandline-first.html
# https://stackoverflow.com/a/74441996/10456057
wget https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
# Write config file.
sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json > /dev/null << 'EOF'
{
    "metrics": {
        "metrics_collected": {
            "mem": {
                "measurement": [
                    "mem_used_percent"
                ],
                "metrics_collection_interval": 30
            },
            "swap": {
                "measurement": [
                    "swap_used_percent"
                ],
                "metrics_collection_interval": 30
            },
            "disk": {
                "measurement": [
                    "used_percent",
                    "inodes_free"
                ],
                "metrics_collection_interval": 30,
                "resources": [
                    "*"
                ]
            }
        }
    }
}
EOF

# Start service
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# Verify it is enabled (auto start on system boot)
sudo systemctl is-enabled amazon-cloudwatch-agent

# Make sure policy CloudWatchAgentServerPolicy configured for the EC2
On EC2, select the instance, then go to Actions->Security->Modify IAM Role
Select EC2-CloudWatch-Agent-Role.
Press Modify.

# Restart service
sudo systemctl restart amazon-cloudwatch-agent
# Delete installer
rm amazon-cloudwatch-agent.deb

# Add server to ~/.ssh/config on your local machine

# Move production .env file
scp ~/Code/kredd/.env.production kredd2:/home/ubuntu/kredd/.env

# Start services.
docker compose up --build -d


# ---- NOTES -----

# Volumes backup/restore

# 0. Inject env into shell
set -a
source .env
set +a



# 1. Lets encrypt - backup

docker run --rm \
  -v kredd_letsencrypt:/data \
  -v $(pwd):/backup \
  alpine \
  tar czf /backup/letsencrypt-backup.tar.gz -C /data .

# Lets encrypt - restore

docker run --rm \
  -v kredd_letsencrypt:/data \
  -v $(pwd):/backup \
  alpine \
  sh -c "cd /data && tar xzf /backup/letsencrypt-backup.tar.gz"

# 2. Minio - backup

docker run --rm \
  -v kredd_minio_data:/data \
  -v $(pwd):/backup \
  alpine \
  tar czf /backup/minio-backup.tar.gz -C /data .

# Minio - restore
docker run --rm \
  -v kredd_minio_data:/data \
  -v $(pwd):/backup \
  alpine \
  sh -c "cd /data && tar xzf /backup/minio-backup.tar.gz"

# MySQL container

# Backup
set -a
source .env
set +a

docker compose exec db mysqldump \
  --single-transaction \
  --no-tablespaces \
  --set-gtid-purged=OFF \
  -u "$KREDD_DB_USER" \
  -p"$KREDD_DB_PASSWORD" \
  "$KREDD_DB_NAME" | gzip > "mysql-$(date +%F).sql.gz"

# Restore
set -a
source .env
set +a

gunzip < mysql-YYYY-MM-DD.sql.gz | docker compose exec -T db \
  mysql -u "$KREDD_DB_USER" -p"$KREDD_DB_PASSWORD" "$KREDD_DB_NAME"

  ----

Deployment:
    Add ram and cpu limits to containers
    Add volume backups
    Check for injection vunerabilities
    Alerts

    Drag questions?
    Add importance/weight




migrate-1   | WARNINGS:
migrate-1   | ?: (staticfiles.W004) The directory '/app/static' in the STATICFILES_DIRS setting does not exist.
