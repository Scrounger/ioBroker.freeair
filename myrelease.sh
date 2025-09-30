#!/bin/bash

dir="${PWD##*/}"
adapterName=${dir//"iobroker."/}

targetFile="/mnt/sata/development/iobroker/adapter/iobroker.$adapterName/src/lib/myIob.ts"

clear

echo "Release Adapter - $adapterName"
echo ""


# Prüfen, ob Datei existiert
if [ -e "$targetFile" ]; then
  cp --remove-destination /mnt/sata/development/iobroker/adapter/shared/myIob.ts "/mnt/sata/development/iobroker/adapter/iobroker.$adapterName/src/lib/"
  echo "✅  myIob.ts symlink mit echter Datei ersetzt"
else
  cp /mnt/sata/development/iobroker/adapter/shared/myIob.ts "/mnt/sata/development/iobroker/adapter/iobroker.$adapterName/src/lib/"
  echo "✅  myIob.ts kopiert"
fi

npm run release -- --all

# Prüfen, ob Datei existiert
if [ -e "$targetFile" ]; then
  rm "$targetFile"
  echo "✅  myIob.ts gelöscht."
else
  echo "⚠️  Datei nicht gefunden: $targetFile"
fi


ln -s /mnt/sata/development/iobroker/adapter/shared/myIob.ts "/mnt/sata/development/iobroker/adapter/iobroker.$adapterName/src/lib/"
echo "✅  myIob.ts symlink erzeugt"