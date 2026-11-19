import type { CommonSetItem } from '@/components/Conf/setup'
import { I18nT } from '@lang/index'

export const minioCommonFields = (): CommonSetItem[] => [
  {
    name: 'MINIO_ADDRESS',
    value: ':9000',
    enable: false,
    type: 'Network',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_ADDRESS')
    }
  },
  {
    name: 'MINIO_CONSOLE_ADDRESS',
    value: '',
    enable: false,
    type: 'Network',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_CONSOLE_ADDRESS')
    }
  },
  {
    name: 'MINIO_CERTS_DIR',
    value: '${HOME}/.minio/certs',
    enable: false,
    type: 'Security',
    isString: true,
    isDir: true,
    tips() {
      return I18nT('minio.MINIO_CERTS_DIR')
    }
  },
  {
    name: 'MINIO_ROOT_USER',
    value: 'minioadmin',
    enable: true,
    type: 'Security',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_ROOT_USER')
    }
  },
  {
    name: 'MINIO_ROOT_PASSWORD',
    value: 'minioadmin',
    enable: true,
    type: 'Security',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_ROOT_PASSWORD')
    }
  },
  {
    name: 'MINIO_SITE_NAME',
    value: 'cal-rack0',
    enable: false,
    type: 'General',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_SITE_NAME')
    }
  },
  {
    name: 'MINIO_SITE_REGION',
    value: 'us-west-1',
    enable: false,
    type: 'General',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_SITE_REGION')
    }
  },
  {
    name: 'MINIO_SITE_COMMENT',
    value: '',
    enable: false,
    type: 'General',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_SITE_COMMENT')
    }
  },
  {
    name: 'MINIO_STORAGE_CLASS_STANDARD',
    value: 'EC:4',
    enable: false,
    type: 'Storage',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_STORAGE_CLASS_STANDARD')
    }
  },
  {
    name: 'MINIO_STORAGE_CLASS_RRS',
    value: 'EC:2',
    enable: false,
    type: 'Storage',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_STORAGE_CLASS_RRS')
    }
  },
  {
    name: 'MINIO_BROWSER',
    value: 'on',
    enable: false,
    type: 'General',
    options: [
      { label: 'on', value: 'on' },
      { label: 'off', value: 'off' }
    ],
    tips() {
      return I18nT('minio.MINIO_BROWSER')
    }
  },
  {
    name: 'MINIO_DOMAIN',
    value: '',
    enable: false,
    type: 'Network',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_DOMAIN')
    }
  },
  {
    name: 'MINIO_ETCD_ENDPOINTS',
    value: 'http://localhost:2379',
    enable: false,
    type: 'Cluster',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_ETCD_ENDPOINTS')
    }
  },
  {
    name: 'MINIO_ETCD_PATH_PREFIX',
    value: '',
    enable: false,
    type: 'Cluster',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_ETCD_PATH_PREFIX')
    }
  },
  {
    name: 'MINIO_API_REQUESTS_MAX',
    value: 'auto',
    enable: false,
    type: 'Performance',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_API_REQUESTS_MAX')
    }
  },
  {
    name: 'MINIO_API_CLUSTER_DEADLINE',
    value: '10s',
    enable: false,
    type: 'Performance',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_API_CLUSTER_DEADLINE')
    }
  },
  {
    name: 'MINIO_API_CORS_ALLOW_ORIGIN',
    value: '*',
    enable: false,
    type: 'Network',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_API_CORS_ALLOW_ORIGIN')
    }
  },
  {
    name: 'MINIO_API_REMOTE_TRANSPORT_DEADLINE',
    value: '2h',
    enable: false,
    type: 'Network',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_API_REMOTE_TRANSPORT_DEADLINE')
    }
  },
  {
    name: 'MINIO_API_LIST_QUORUM',
    value: 'strict',
    enable: false,
    type: 'Performance',
    options: [
      { label: 'optimal', value: 'optimal' },
      { label: 'reduced', value: 'reduced' },
      { label: 'disk', value: 'disk' },
      { label: 'strict', value: 'strict' },
      { label: 'auto', value: 'auto' }
    ],
    tips() {
      return I18nT('minio.MINIO_API_LIST_QUORUM')
    }
  },
  {
    name: 'MINIO_API_REPLICATION_PRIORITY',
    value: 'auto',
    enable: false,
    type: 'Performance',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_API_REPLICATION_PRIORITY')
    }
  },
  {
    name: 'MINIO_API_REPLICATION_MAX_WORKERS',
    value: '500',
    enable: false,
    type: 'Performance',
    tips() {
      return I18nT('minio.MINIO_API_REPLICATION_MAX_WORKERS')
    }
  },
  {
    name: 'MINIO_API_TRANSITION_WORKERS',
    value: '100',
    enable: false,
    type: 'Performance',
    tips() {
      return I18nT('minio.MINIO_API_TRANSITION_WORKERS')
    }
  },
  {
    name: 'MINIO_API_STALE_UPLOADS_EXPIRY',
    value: '24h',
    enable: false,
    type: 'Storage',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_API_STALE_UPLOADS_EXPIRY')
    }
  },
  {
    name: 'MINIO_API_STALE_UPLOADS_CLEANUP_INTERVAL',
    value: '6h',
    enable: false,
    type: 'Storage',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_API_STALE_UPLOADS_CLEANUP_INTERVAL')
    }
  },
  {
    name: 'MINIO_API_DELETE_CLEANUP_INTERVAL',
    value: '5m',
    enable: false,
    type: 'Storage',
    isString: true,
    tips() {
      return I18nT('minio.MINIO_API_DELETE_CLEANUP_INTERVAL')
    }
  },
  {
    name: 'MINIO_API_ODIRECT',
    value: 'on',
    enable: false,
    type: 'Performance',
    options: [
      { label: 'on', value: 'on' },
      { label: 'off', value: 'off' }
    ],
    tips() {
      return I18nT('minio.MINIO_API_ODIRECT')
    }
  },
  {
    name: 'MINIO_API_ROOT_ACCESS',
    value: 'on',
    enable: false,
    type: 'Security',
    options: [
      { label: 'on', value: 'on' },
      { label: 'off', value: 'off' }
    ],
    tips() {
      return I18nT('minio.MINIO_API_ROOT_ACCESS')
    }
  },
  {
    name: 'MINIO_API_SYNC_EVENTS',
    value: 'off',
    enable: false,
    type: 'Performance',
    options: [
      { label: 'on', value: 'on' },
      { label: 'off', value: 'off' }
    ],
    tips() {
      return I18nT('minio.MINIO_API_SYNC_EVENTS')
    }
  },
  {
    name: 'MINIO_API_OBJECT_MAX_VERSIONS',
    value: '9223372036854775807',
    enable: false,
    type: 'Storage',
    tips() {
      return I18nT('minio.MINIO_API_OBJECT_MAX_VERSIONS')
    }
  }
]
