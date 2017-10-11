#!/bin/bash

echo "checking WiFi connection..."
CONNECTIONS=$(nmcli dev)
# echo "${CONNECTIONS}"
if [[ "$CONNECTIONS" =~ "disconnected" ]]; then
    echo "disconnected, running changeWiFiDongleToHotspot.sh"
    exec "/root/WoT/gateway/wot-gateway/auth/changeWiFiDongleToHotspot.sh"
elif [[ "$CONNECTIONS" =~ "connected" ]]; then
    echo "connected"
else    
    echo "Error, neither connected nor disconnected!"
fi
echo "finished checking WiFi connection"