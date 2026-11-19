import type { CommonSetItem } from '@/components/Conf/setup'
import { I18nT } from '@lang/index'

export const n8nCommonFields = (): CommonSetItem[] => [
  {
    name: 'N8N_PORT',
    value: '5678',
    enable: false,
    tips() {
      return I18nT('n8n.N8N_PORT')
    }
  },
  {
    name: 'N8N_HOST',
    value: 'localhost',
    enable: false,
    tips() {
      return I18nT('n8n.N8N_HOST')
    }
  },
  {
    name: 'N8N_PROTOCOL',
    value: 'http',
    enable: false,
    tips() {
      return I18nT('n8n.N8N_PROTOCOL')
    }
  },
  {
    name: 'N8N_PATH',
    value: '/',
    enable: false,
    tips() {
      return I18nT('n8n.N8N_PATH')
    }
  },
  {
    name: 'DB_TYPE',
    value: 'sqlite',
    enable: false,
    tips() {
      return I18nT('n8n.DB_TYPE')
    }
  },
  {
    name: 'N8N_USER_FOLDER',
    value: '',
    enable: false,
    isString: true,
    tips() {
      return I18nT('n8n.N8N_USER_FOLDER')
    }
  },
  {
    name: 'N8N_ENCRYPTION_KEY',
    value: '',
    enable: false,
    isString: true,
    tips() {
      return I18nT('n8n.N8N_ENCRYPTION_KEY')
    }
  },
  {
    name: 'WEBHOOK_URL',
    value: '',
    enable: false,
    isString: true,
    tips() {
      return I18nT('n8n.WEBHOOK_URL')
    }
  },
  {
    name: 'N8N_LOG_LEVEL',
    value: 'info',
    enable: false,
    tips() {
      return I18nT('n8n.N8N_LOG_LEVEL')
    }
  },
  {
    name: 'N8N_LOG_OUTPUT',
    value: 'console',
    enable: false,
    tips() {
      return I18nT('n8n.N8N_LOG_OUTPUT')
    }
  },
  {
    name: 'EXECUTIONS_PROCESS',
    value: 'main',
    enable: false,
    tips() {
      return I18nT('n8n.EXECUTIONS_PROCESS')
    }
  },
  {
    name: 'EXECUTIONS_MODE',
    value: 'regular',
    enable: false,
    tips() {
      return I18nT('n8n.EXECUTIONS_MODE')
    }
  },
  {
    name: 'N8N_METRICS',
    value: 'false',
    enable: false,
    tips() {
      return I18nT('n8n.N8N_METRICS')
    }
  }
]
