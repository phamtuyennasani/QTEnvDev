import { join } from '@/util/path-browserify'

const certificateName = 'QTEnvDev-Root-CA.crt'
const shellArgument = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'"

export function localCertificatePath(baseDir: string) {
  return join(baseDir, 'CA', certificateName)
}

export function localCertificateTrustCommand(
  path: string,
  platform: 'windows' | 'macos' | 'linux'
) {
  if (platform === 'windows') {
    // Use PowerShell argument quoting, including paths that contain spaces or apostrophes.
    const argument = "'" + path.replaceAll('/', '\\').replaceAll("'", "''") + "'"
    return 'certutil.exe -addstore Root ' + argument
  }
  if (platform === 'macos') {
    return (
      'sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ' +
      shellArgument(path)
    )
  }
  const script = [
    'if [ -d /usr/local/share/ca-certificates ]; then',
    '  cp -- "$1" /usr/local/share/ca-certificates/' +
      certificateName +
      ' && update-ca-certificates',
    'elif [ -d /etc/pki/ca-trust/source/anchors ]; then',
    '  cp -- "$1" /etc/pki/ca-trust/source/anchors/' +
      certificateName +
      ' && update-ca-trust extract',
    'else',
    '  echo "Unsupported Linux distribution" >&2',
    '  exit 1',
    'fi'
  ].join('\n')
  return 'sudo sh -c ' + shellArgument(script) + ' sh ' + shellArgument(path)
}
