import type { CommonSetItem } from '@/components/Conf/setup'
import { I18nT } from '@lang/index'

export const meilisearchCommonFields = (): CommonSetItem[] => [
  {
    name: 'db_path',
    value: './data.ms',
    enable: false,
    type: 'General',
    isString: true,
    isDir: true,
    tips() {
      return I18nT('meilisearch.db_path')
    }
  },
  {
    name: 'env',
    value: 'development',
    enable: false,
    type: 'General',
    isString: true,
    options: [
      {
        label: 'development',
        value: 'development'
      },
      {
        label: 'production',
        value: 'production'
      }
    ],
    tips() {
      return I18nT('meilisearch.env')
    }
  },
  {
    name: 'http_addr',
    value: 'localhost:7700',
    enable: false,
    type: 'Network',
    isString: true,
    tips() {
      return I18nT('meilisearch.http_addr')
    }
  },
  {
    name: 'master_key',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    tips() {
      return I18nT('meilisearch.master_key')
    }
  },
  {
    name: 'no_analytics',
    value: 'false',
    enable: false,
    type: 'General',
    options: [
      {
        label: 'false',
        value: 'false'
      },
      {
        label: 'true',
        value: 'true'
      }
    ],
    tips() {
      return I18nT('meilisearch.no_analytics')
    }
  },
  {
    name: 'http_payload_size_limit',
    value: '100 MB',
    enable: false,
    type: 'Network',
    isString: true,
    tips() {
      return I18nT('meilisearch.http_payload_size_limit')
    }
  },
  {
    name: 'log_level',
    value: 'INFO',
    enable: false,
    type: 'General',
    isString: true,
    options: [
      { label: 'OFF', value: 'OFF' },
      { label: 'ERROR', value: 'ERROR' },
      { label: 'WARN', value: 'WARN' },
      { label: 'INFO', value: 'INFO' },
      { label: 'DEBUG', value: 'DEBUG' },
      { label: 'TRACE', value: 'TRACE' }
    ],
    tips() {
      return I18nT('meilisearch.log_level')
    }
  },
  {
    name: 'max_indexing_memory',
    value: '2 GiB',
    enable: false,
    type: 'Performance',
    isString: true,
    tips() {
      return I18nT('meilisearch.max_indexing_memory')
    }
  },
  {
    name: 'max_indexing_threads',
    value: '4',
    enable: false,
    type: 'Performance',
    tips() {
      return I18nT('meilisearch.max_indexing_threads')
    }
  },
  {
    name: 'dump_dir',
    value: 'dumps/',
    enable: false,
    type: 'Backup',
    isString: true,
    isDir: true,
    tips() {
      return I18nT('meilisearch.dump_dir')
    }
  },
  {
    name: 'import_dump',
    value: '',
    enable: false,
    type: 'Backup',
    isString: true,
    isFile: true,
    tips() {
      return I18nT('meilisearch.import_dump')
    }
  },
  {
    name: 'ignore_missing_dump',
    value: 'false',
    enable: false,
    type: 'Backup',
    options: [
      {
        label: 'false',
        value: 'false'
      },
      {
        label: 'true',
        value: 'true'
      }
    ],
    tips() {
      return I18nT('meilisearch.ignore_missing_dump')
    }
  },
  {
    name: 'ignore_dump_if_db_exists',
    value: 'false',
    enable: false,
    type: 'Backup',
    options: [
      {
        label: 'false',
        value: 'false'
      },
      {
        label: 'true',
        value: 'true'
      }
    ],
    tips() {
      return I18nT('meilisearch.ignore_dump_if_db_exists')
    }
  },
  {
    name: 'schedule_snapshot',
    value: 'false',
    enable: false,
    type: 'Backup',
    options: [
      {
        label: 'false',
        value: 'false'
      },
      {
        label: 'true',
        value: 'true'
      }
    ],
    tips() {
      return I18nT('meilisearch.schedule_snapshot')
    }
  },
  {
    name: 'snapshot_dir',
    value: 'snapshots/',
    enable: false,
    type: 'Backup',
    isString: true,
    isDir: true,
    tips() {
      return I18nT('meilisearch.snapshot_dir')
    }
  },
  {
    name: 'import_snapshot',
    value: '',
    enable: false,
    type: 'Backup',
    isString: true,
    isFile: true,
    tips() {
      return I18nT('meilisearch.import_snapshot')
    }
  },
  {
    name: 'ignore_missing_snapshot',
    value: 'false',
    enable: false,
    type: 'Backup',
    options: [
      {
        label: 'false',
        value: 'false'
      },
      {
        label: 'true',
        value: 'true'
      }
    ],
    tips() {
      return I18nT('meilisearch.ignore_missing_snapshot')
    }
  },
  {
    name: 'ignore_snapshot_if_db_exists',
    value: 'false',
    enable: false,
    type: 'Backup',
    options: [
      {
        label: 'false',
        value: 'false'
      },
      {
        label: 'true',
        value: 'true'
      }
    ],
    tips() {
      return I18nT('meilisearch.ignore_snapshot_if_db_exists')
    }
  },
  {
    name: 'ssl_cert_path',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    isFile: true,
    tips() {
      return I18nT('meilisearch.ssl_cert_path')
    }
  },
  {
    name: 'ssl_key_path',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    isFile: true,
    tips() {
      return I18nT('meilisearch.ssl_key_path')
    }
  },
  {
    name: 'ssl_auth_path',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    isDir: true,
    tips() {
      return I18nT('meilisearch.ssl_auth_path')
    }
  },
  {
    name: 'ssl_ocsp_path',
    value: '',
    enable: false,
    type: 'Security',
    isString: true,
    isFile: true,
    tips() {
      return I18nT('meilisearch.ssl_ocsp_path')
    }
  },
  {
    name: 'ssl_require_auth',
    value: 'false',
    enable: false,
    type: 'Security',
    options: [
      {
        label: 'false',
        value: 'false'
      },
      {
        label: 'true',
        value: 'true'
      }
    ],
    tips() {
      return I18nT('meilisearch.ssl_require_auth')
    }
  },
  {
    name: 'ssl_resumption',
    value: 'false',
    enable: false,
    type: 'Security',
    options: [
      {
        label: 'false',
        value: 'false'
      },
      {
        label: 'true',
        value: 'true'
      }
    ],
    tips() {
      return I18nT('meilisearch.ssl_resumption')
    }
  },
  {
    name: 'ssl_tickets',
    value: 'false',
    enable: false,
    type: 'Security',
    options: [
      {
        label: 'false',
        value: 'false'
      },
      {
        label: 'true',
        value: 'true'
      }
    ],
    tips() {
      return I18nT('meilisearch.ssl_tickets')
    }
  },
  {
    name: 'experimental_enable_metrics',
    value: 'false',
    enable: false,
    type: 'Experimental',
    options: [
      {
        label: 'false',
        value: 'false'
      },
      {
        label: 'true',
        value: 'true'
      }
    ],
    tips() {
      return I18nT('meilisearch.experimental_enable_metrics')
    }
  },
  {
    name: 'experimental_reduce_indexing_memory_usage',
    value: 'false',
    enable: false,
    type: 'Experimental',
    options: [
      {
        label: 'false',
        value: 'false'
      },
      {
        label: 'true',
        value: 'true'
      }
    ],
    tips() {
      return I18nT('meilisearch.experimental_reduce_indexing_memory_usage')
    }
  },
  {
    name: 'experimental_max_number_of_batched_tasks',
    value: '100',
    enable: false,
    type: 'Experimental',
    tips() {
      return I18nT('meilisearch.experimental_max_number_of_batched_tasks')
    }
  }
]
