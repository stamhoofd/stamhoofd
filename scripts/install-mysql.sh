#!/bin/bash
set -e

MYSQL_DEFAULT_PASSWORD=root
MYSQL_ROOT_PASSWORD=root

echo ""
echo "Adding MySQL package..."

apt-get update
wget https://dev.mysql.com/get/mysql-apt-config_0.8.15-1_all.deb

dpkg -i mysql-apt-config*

echo "Updating apt get..."
apt-get update
rm mysql-apt-config*

echo "Installing MySQL..."
apt-get -y install mysql-server

echo "Installing MySQL timezones..."

echo ""
echo "Securing MySQL..."
echo "Please keep root / root as password and ignore validate password plugin."
echo ""
mysql_secure_installation
