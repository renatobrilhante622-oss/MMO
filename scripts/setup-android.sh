#!/usr/bin/env bash
set -euo pipefail
# Official Android and Eclipse Adoptium artifacts; SHA256 values published by their vendors.
android_setup_root="${CLOUD_ANDROID_ROOT:-/workspace/.android-sdk}"
android_setup_cache="${CLOUD_ANDROID_CACHE:-/workspace/.cache/android}"
mkdir -p "$android_setup_root" "$android_setup_cache" "$android_setup_cache/user/.android"
android_fetch_verified() {
  local android_url="$1" android_path="$2" android_hash="$3"
  if [ ! -f "$android_path" ]; then
    curl --fail --location --retry 2 --proto '=https' --tlsv1.2 "$android_url" --output "$android_path"
  fi
  printf '%s  %s\n' "$android_hash" "$android_path" | sha256sum --check --status
}
if [ ! -x "$android_setup_root/cmdline-tools/latest/bin/sdkmanager" ]; then
  android_fetch_verified 'https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip' "$android_setup_cache/commandlinetools-linux-15859902_latest.zip" '4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583'
  android_sdk_temp="$(mktemp -d "$android_setup_cache/sdk.XXXXXX")"
  unzip -q "$android_setup_cache/commandlinetools-linux-15859902_latest.zip" -d "$android_sdk_temp"
  mkdir -p "$android_setup_root/cmdline-tools"
  mv "$android_sdk_temp/cmdline-tools" "$android_setup_root/cmdline-tools/latest"
  rmdir "$android_sdk_temp"
fi
if [ ! -x "$android_setup_root/jdk-21/bin/javac" ]; then
  android_fetch_verified 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.13%2B9/OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz' "$android_setup_cache/OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz" 'd7f5d5cf865a2902b70ff549b97586a7d3f234e016f041ab447ea740c7d66d1c'
  mkdir -p "$android_setup_root/jdk-21"
  tar -xzf "$android_setup_cache/OpenJDK21U-jdk_x64_linux_hotspot_21.0.13_9.tar.gz" --strip-components=1 -C "$android_setup_root/jdk-21"
fi
export ANDROID_HOME="$android_setup_root"
export ANDROID_SDK_ROOT="$android_setup_root"
export ANDROID_USER_HOME="$android_setup_cache/user/.android"
export JAVA_HOME="$android_setup_root/jdk-21"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/workspace/.cache/gradle}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
# Java does not read HTTP_PROXY itself. Preserve credential injection through the existing proxy.
# This stores only non-secret hostname/port metadata, never authentication values.
python3 - "$GRADLE_USER_HOME" "$android_setup_cache" <<'PYCONFIG'
import os,pathlib,urllib.parse,sys
home=pathlib.Path(sys.argv[1]); home.mkdir(parents=True,exist_ok=True)
cache=pathlib.Path(sys.argv[2]); path=home/'gradle.properties'
props={ 'systemProp.user.home':str(cache/'user') }
trust=pathlib.Path('/etc/ssl/certs/java/cacerts')
if trust.exists(): props['systemProp.javax.net.ssl.trustStore']=str(trust)
proxy=os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
if proxy:
 u=urllib.parse.urlsplit(proxy)
 if u.username or u.password: raise SystemExit('Proxy has credentials; use the platform-supported Java proxy route instead of persisting credentials.')
 if not u.hostname: raise SystemExit('Invalid proxy hostname')
 for scheme in ('https','http'):
  props[f'systemProp.{scheme}.proxyHost']=u.hostname
  props[f'systemProp.{scheme}.proxyPort']=str(u.port or 80)
existing=path.read_text().splitlines() if path.exists() else []
lines=[line for line in existing if line.partition('=')[0].strip() not in props]
path.write_text('\n'.join(lines+[f'{key}={value}' for key,value in props.items()])+'\n')
PYCONFIG
if [ ! -f "$ANDROID_HOME/platforms/android-36/android.jar" ] || [ ! -x "$ANDROID_HOME/build-tools/36.0.0/aapt2" ] || [ ! -x "$ANDROID_HOME/build-tools/35.0.0/aapt2" ]; then
  # The requested Android toolchain installation includes the SDK license acceptance.
  python3 - "$ANDROID_HOME" <<'PYINSTALL'
import os,pathlib,subprocess,sys,urllib.parse
root=pathlib.Path(sys.argv[1]); e=os.environ.copy()
opts=['-Duser.home='+str(pathlib.Path(os.environ['ANDROID_USER_HOME']).parent)]
if pathlib.Path('/etc/ssl/certs/java/cacerts').exists(): opts+=['-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts']
p=os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
if p:
 u=urllib.parse.urlsplit(p)
 if u.username or u.password: raise SystemExit('Proxy credentials must not be stored in setup scripts.')
 for scheme in ('http','https'): opts += [f'-D{scheme}.proxyHost={u.hostname}',f'-D{scheme}.proxyPort={u.port or 80}']
e['SDKMANAGER_OPTS']=' '.join(opts)
args=[str(root/'cmdline-tools/latest/bin/sdkmanager'),'--sdk_root='+str(root),'platforms;android-36','build-tools;36.0.0','build-tools;35.0.0','platform-tools']
raise SystemExit(subprocess.run(args,input='y\n'*100,text=True,env=e).returncode)
PYINSTALL
fi
javac -version
"$ANDROID_HOME/build-tools/36.0.0/aapt2" version
printf 'Android SDK: %s\nJDK: %s\nGradle cache: %s\n' "$ANDROID_HOME" "$JAVA_HOME" "$GRADLE_USER_HOME"
