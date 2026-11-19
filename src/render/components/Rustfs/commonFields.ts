import type { CommonSetItem } from '@/components/Conf/setup'
import { I18nT } from '@lang/index'

export const rustfsCommonFields = (): CommonSetItem[] => [
  {
    name: 'RUSTFS_ADDRESS',
    value: ':9000',
    enable: false,
    type: 'Network',
    isString: true,
    tips() {
      return I18nT('rustfs.RUSTFS_ADDRESS')
    }
  },
  {
    name: 'RUSTFS_ACCESS_KEY',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    tips() {
      return I18nT('rustfs.RUSTFS_ACCESS_KEY')
    }
  },
  {
    name: 'RUSTFS_ACCESS_KEY_FILE',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    isFile: true,
    tips() {
      return I18nT('rustfs.RUSTFS_ACCESS_KEY_FILE')
    }
  },
  {
    name: 'RUSTFS_SECRET_KEY',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    tips() {
      return I18nT('rustfs.RUSTFS_SECRET_KEY')
    }
  },
  {
    name: 'RUSTFS_SECRET_KEY_FILE',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    isFile: true,
    tips() {
      return I18nT('rustfs.RUSTFS_SECRET_KEY_FILE')
    }
  },
  {
    name: 'RUSTFS_CONSOLE_ENABLE',
    value: 'true',
    enable: false,
    type: 'General',
    options: [
      { label: 'true', value: 'true' },
      { label: 'false', value: 'false' }
    ],
    tips() {
      return I18nT('rustfs.RUSTFS_CONSOLE_ENABLE')
    }
  },
  {
    name: 'RUSTFS_CONSOLE_ADDRESS',
    value: ':9001',
    enable: false,
    type: 'Network',
    isString: true,
    tips() {
      return I18nT('rustfs.RUSTFS_CONSOLE_ADDRESS')
    }
  },
  {
    name: 'RUSTFS_SERVER_DOMAINS',
    value: '',
    enable: false,
    type: 'Network',
    isString: true,
    tips() {
      return I18nT('rustfs.RUSTFS_SERVER_DOMAINS')
    }
  },
  {
    name: 'RUSTFS_TLS_PATH',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    isDir: true,
    tips() {
      return I18nT('rustfs.RUSTFS_TLS_PATH')
    }
  },
  {
    name: 'RUSTFS_REGION',
    value: '',
    enable: false,
    type: 'General',
    isString: true,
    tips() {
      return I18nT('rustfs.RUSTFS_REGION')
    }
  },
  {
    name: 'RUSTFS_LICENSE',
    value: '',
    enable: false,
    type: 'General',
    isString: true,
    tips() {
      return I18nT('rustfs.RUSTFS_LICENSE')
    }
  },
  {
    name: 'RUSTFS_KMS_ENABLE',
    value: 'false',
    enable: false,
    type: 'Security',
    options: [
      { label: 'true', value: 'true' },
      { label: 'false', value: 'false' }
    ],
    tips() {
      return I18nT('rustfs.RUSTFS_KMS_ENABLE')
    }
  },
  {
    name: 'RUSTFS_KMS_BACKEND',
    value: 'local',
    enable: false,
    type: 'Security',
    options: [
      { label: 'local', value: 'local' },
      { label: 'vault', value: 'vault' }
    ],
    tips() {
      return I18nT('rustfs.RUSTFS_KMS_BACKEND')
    }
  },
  {
    name: 'RUSTFS_KMS_KEY_DIR',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    isDir: true,
    tips() {
      return I18nT('rustfs.RUSTFS_KMS_KEY_DIR')
    }
  },
  {
    name: 'RUSTFS_KMS_VAULT_ADDRESS',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    tips() {
      return I18nT('rustfs.RUSTFS_KMS_VAULT_ADDRESS')
    }
  },
  {
    name: 'RUSTFS_KMS_VAULT_TOKEN',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    tips() {
      return I18nT('rustfs.RUSTFS_KMS_VAULT_TOKEN')
    }
  },
  {
    name: 'RUSTFS_KMS_DEFAULT_KEY_ID',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    tips() {
      return I18nT('rustfs.RUSTFS_KMS_DEFAULT_KEY_ID')
    }
  },
  {
    name: 'RUSTFS_OBS_ENDPOINT',
    value: '',
    enable: false,
    type: 'Advanced',
    isString: true,
    tips() {
      return I18nT('rustfs.RUSTFS_OBS_ENDPOINT')
    }
  },
  {
    name: 'RUSTFS_BUFFER_PROFILE_DISABLE',
    value: 'false',
    enable: false,
    type: 'Performance',
    options: [
      { label: 'true', value: 'true' },
      { label: 'false', value: 'false' }
    ],
    tips() {
      return I18nT('rustfs.RUSTFS_BUFFER_PROFILE_DISABLE')
    }
  },
  {
    name: 'RUSTFS_BUFFER_PROFILE',
    value: 'GeneralPurpose',
    enable: false,
    type: 'Performance',
    options: [
      { label: 'GeneralPurpose', value: 'GeneralPurpose' },
      { label: 'AiTraining', value: 'AiTraining' },
      { label: 'DataAnalytics', value: 'DataAnalytics' },
      { label: 'WebWorkload', value: 'WebWorkload' },
      { label: 'IndustrialIoT', value: 'IndustrialIoT' },
      { label: 'SecureStorage', value: 'SecureStorage' }
    ],
    tips() {
      return I18nT('rustfs.RUSTFS_BUFFER_PROFILE')
    }
  }
]
