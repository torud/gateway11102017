sudo service hostapd stop
sudo service udhcpd stop
sudo update-rc.d hostapd disable
sudo update-rc.d udhcpd disable

cat <<EOT > '/etc/default/hostapd'
# Defaults for hostapd initscript
#
# See /usr/share/doc/hostapd/README.Debian for information about alternative
# methods of managing hostapd.
#
# Uncomment and set DAEMON_CONF to the absolute path of a hostapd configuration
# file and hostapd will be started during system boot. An example configuration
# file can be found at /usr/share/doc/hostapd/examples/hostapd.conf.gz
#
#DAEMON_CONF="/etc/hostapd/hostapd.conf"

# Additional daemon options to be appended to hostapd command:-
#       -d   show more debug messages (-dd for even more)
#       -K   include key data in debug messages
#       -t   include timestamps in some debug messages
#
# Note that -B (daemon mode) and -P (pidfile) options are automatically
# configured by the init.d script and must not be added to DAEMON_OPTS.
EOT

cat <<EOT > '/etc/network/interfaces'
# interfaces(5) file used by ifup(8) and ifdown(8)
# Include files from /etc/network/interfaces.d:
source-directory /etc/network/interfaces.d

allow-hotplug eth0
        iface eth0 inet dhcp

#allow-hotplug wlan0
#iface wlan0 inet dhcp
#        wpa-conf /etc/wpa_supplicant/wpa_supplicant.conf

#allow-hotplug wlan0
#iface wlan0 inet static
#        address 192.168.2.1
#        netmask 255.255.255.0
EOT

cat <<EOT > '/etc/rc.local'
#!/bin/sh -e

# rc.local
#
# This script is executed at the end of each multiuser runlevel.
# Make sure that the script will "exit 0" on success or any other
# value on error.
#
# In order to enable or disable this script just change the execution
# bits.
#
# By default this script does nothing.

. /usr/bin/setqt4env
/usr/bin/lcd2usb_print "CPU: {{CPU}}" "Mem: {{MEM}}" "IP: {{IP}}" "LoadAvg: {{LOADAVG}}" 2>&1 > /dev/null&
/opt/QtE-Demo/run.sh&

#ifconfig wlan0 192.168.2.1
#service hostapd restart
#service udhcpd restart

exit 0
EOT

sudo systemctl start NetworkManager.service
sudo systemctl enable NetworkManager.service                        
sudo nmcli r wifi on

sleep 1