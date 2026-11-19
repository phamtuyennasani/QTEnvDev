import { sslOperation } from './Operation'
import { join, basename } from '@/util/path-browserify'
import { uuid } from '@/util/Index'
import { MessageError, MessageSuccess } from '@/util/Element'
import { shell, fs, exec } from '@/util/NodeFn'
import { I18nT } from '@lang/index'
import Base from '@/core/Base'
export type SSLItem = { domains: string; root: string; savePath: string }
const EOL = '\n'
export const generateCertificates = async (input: SSLItem) => {
  if (sslOperation.running) return
  const snapshot: SSLItem = JSON.parse(JSON.stringify(input))
  const domains = snapshot.domains.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
  if (!domains.length || !snapshot.savePath.trim() || domains.some((domain) => !/^(?:\*\.)?[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(domain))) { sslOperation.error = 'Enter valid domains and choose an output folder.'; MessageError(sslOperation.error); return }
    if (window.Server.isWindows) {
      sslOperation.run('app-fork:tools', ['sslMake', snapshot], () => {
            MessageSuccess(I18nT('base.success'))
      }).then(async (done) => {
        if (done) { try { const result = await shell.openPath(snapshot.savePath); if (result) sslOperation.warning = String(result) } catch (error) { sslOperation.warning = String(error) } }
        else MessageError(sslOperation.error)
      })
      return
    }
    await sslOperation.runLocal(async () => {
    try {
      const domains = snapshot.domains
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)

      const saveName = uuid(6) + '.' + domains[0].replace('*.', '')
      let caFile = snapshot.root
      let caFileName = basename(caFile)

      if (caFile.length === 0) {
        caFile = join(snapshot.savePath, uuid(6) + '.RootCA.crt')
        caFileName = basename(caFile)
      }

      caFile = caFile.replace('.crt', '')
      caFileName = caFileName.replace('.crt', '')
      const opt: any = { cwd: snapshot.savePath }

      let exists = await fs.existsSync(caFile + '.crt')
      if (!exists) {
        let command = `openssl genrsa -out "${caFileName}.key" 2048;`
        command += `openssl req -new -key "${caFileName}.key" -out "${caFileName}.csr" -sha256 -subj "/CN=Dev Root CA ${caFileName}";`
        command += `echo "basicConstraints = critical,CA:TRUE\nkeyUsage = critical,keyCertSign,cRLSign\nsubjectKeyIdentifier = hash\nauthorityKeyIdentifier = keyid:always,issuer" > "${caFileName}.cnf";`
        command += `openssl x509 -req -in "${caFileName}.csr" -signkey "${caFileName}.key" -out "${caFileName}.crt" -extfile "${caFileName}.cnf" -sha256 -days 3650;`
        await exec.exec(command, opt)
      }

      let ext = `authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage=digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName=@alt_names

[alt_names]${EOL}`
      domains.forEach((item, index) => {
        ext += `DNS.${index + 1} = ${item}${EOL}`
      })
      ext += `IP.1 = 127.0.0.1${EOL}`
      await fs.writeFile(join(snapshot.savePath, `${saveName}.ext`), ext)

      let command = `openssl req -new -newkey rsa:2048 -nodes -keyout "${saveName}.key" -out "${saveName}.csr" -sha256 -subj "/CN=${saveName}";`
      command += `openssl x509 -req -in "${saveName}.csr" -out "${saveName}.crt" -extfile "${saveName}.ext" -CA "${caFile}.crt" -CAkey "${caFile}.key" -CAcreateserial -CAserial "${caFile}.srl" -sha256 -days 3650;`
      await exec.exec(command, opt)

      exists = await fs.existsSync(join(snapshot.savePath, `${saveName}.crt`))
      if (exists) {
        Base.Alert(I18nT('base.sslMakeAlert', { caFileName }), I18nT('base.prompt'))
          .then(() => {
            shell.showItemInFolder(`${caFile}.crt`)
          })
          .catch()
      } else throw new Error('Certificate output was not created.')
    } catch (error) {
      console.error('Error generating SSL:', error)
      MessageError(I18nT('base.fail'))
      throw error
    }
    })
  }