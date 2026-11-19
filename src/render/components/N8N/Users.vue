<template>
  <el-card class="app-base-el-card">
    <template #header>
      <!-- Data Directory row (always visible) -->
      <div class="flex items-center gap-3 h-[30px]">
        <span class="text-sm font-medium whitespace-nowrap">{{ I18nT('n8n.usersDataDir') }}</span>
        <el-input :model-value="dataDir" size="small" readonly class="flex-1" />
        <el-button size="small" :loading="scanning" :disabled="!controller.writable" @click="scanDataDir">{{
          I18nT('n8n.usersDataDirScan')
        }}</el-button>
        <el-button size="small" :disabled="!controller.writable" @click="chooseDataDir">{{
          I18nT('n8n.usersDataDirChange')
        }}</el-button>
      </div>
    </template>
    <template #default>
      <div class="h-full overflow-hidden flex flex-col">
        <el-alert v-if="controller.unknown" type="warning" :closable="false"
          title="The last change is unconfirmed. Verify it in n8n before repeating the operation." />
        <!-- Toolbar -->
        <div class="flex items-center gap-2 mb-4 flex-shrink-0">
          <el-button :loading="loading" :disabled="!!controller.pending" @click="loadUsers">{{
            I18nT('common.action.refresh')
          }}</el-button>
          <el-button type="primary" :disabled="!controller.canManageUsers" @click="openAddDialog">
            {{ I18nT('n8n.usersAddUser') }}
          </el-button>
          <el-button :disabled="!controller.canManageUsers" @click="openChangePasswordDialog">{{
            I18nT('common.action.changeOwnerPassword')
          }}</el-button>
          <el-button v-if="inviteUrl" @click="showInviteUrlDialog = true">{{
            I18nT('n8n.usersInviteUrlTitle')
          }}</el-button>
        </div>

        <!-- Users table — reads from SQLite directly, works offline -->
        <el-table v-loading="loading" class="flex-1 overflow-hidden" :data="users" border>
          <el-table-column :label="I18nT('common.label.name')" min-width="150">
            <template #default="{ row }">{{ row.firstName }} {{ row.lastName }}</template>
          </el-table-column>
          <el-table-column prop="email" :label="I18nT('n8n.usersEmail')" min-width="200" />
          <el-table-column :label="I18nT('n8n.usersRole')" width="120">
            <template #default="{ row }">{{ formatRole(row.roleSlug) }}</template>
          </el-table-column>
          <el-table-column :label="I18nT('common.label.status')" width="100">
            <template #default="{ row }">
              <el-tag
                :type="row.disabled ? 'info' : row.isPending ? 'warning' : 'success'"
                size="small"
              >
                {{
                  row.disabled
                    ? I18nT('common.state.disabled')
                    : row.isPending
                      ? I18nT('n8n.usersPending')
                      : I18nT('n8n.usersActive')
                }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="I18nT('n8n.usersActions')" width="80">
            <template #default="{ row }">
              <div class="w-full h-full flex items-center justify-center">
                <el-dropdown :disabled="!controller.canManageUsers" trigger="click" @command="(cmd: string) => handleAction(cmd, row)">
                  <el-button type="primary" link size="small">&#8943;</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="name">{{
                        I18nT('common.action.changeName')
                      }}</el-dropdown-item>
                      <el-dropdown-item command="password">{{
                        I18nT('common.action.resetPassword')
                      }}</el-dropdown-item>
                      <el-dropdown-item v-if="row.roleSlug !== 'global:owner'" command="role">{{
                        I18nT('common.action.changeRole')
                      }}</el-dropdown-item>
                      <el-dropdown-item
                        v-if="row.roleSlug !== 'global:owner'"
                        :command="row.disabled ? 'enable' : 'disable'"
                      >
                        {{
                          row.disabled
                            ? I18nT('common.action.enable')
                            : I18nT('common.action.disable')
                        }}
                      </el-dropdown-item>
                      <el-dropdown-item
                        v-if="row.roleSlug !== 'global:owner'"
                        command="delete"
                        style="color: var(--el-color-danger)"
                        >{{ I18nT('common.action.delete') }}</el-dropdown-item
                      >
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </el-card>
  <div>
    <!-- Scan results dialog -->
    <el-dialog
      v-model="showScanDialog"
      :title="I18nT('n8n.usersDataDirScanTitle')"
      width="520px"
      :destroy-on-close="true"
    >
      <p class="text-sm text-gray-500 mb-3">{{ I18nT('n8n.usersDataDirScanTip') }}</p>
      <el-radio-group v-model="scanSelected" class="flex flex-col gap-2">
        <el-radio v-for="p in scanResults" :key="p" :value="p" class="font-mono text-sm">{{
          p
        }}</el-radio>
      </el-radio-group>
      <template #footer>
        <el-button @click="showScanDialog = false">{{ I18nT('base.cancel') }}</el-button>
        <el-button type="primary" :disabled="!scanSelected" @click="applyScanResult">{{
          I18nT('base.confirm')
        }}</el-button>
      </template>
    </el-dialog>

    <!-- Delete confirm dialog -->
    <el-dialog
      v-model="showDeleteDialog"
      :title="I18nT('n8n.usersActions')"
      width="440px"
      :destroy-on-close="true"
    >
      <p class="mb-3 text-sm">{{
        I18nT('n8n.usersDeleteConfirm', { email: deletingRow?.email })
      }}</p>
      <template #footer>
        <el-button @click="showDeleteDialog = false">{{ I18nT('base.cancel') }}</el-button>
        <el-button type="danger" :loading="!!deletingId" @click="confirmDelete">
          {{ I18nT('common.action.delete') }}
        </el-button>
      </template>
    </el-dialog>
    <!-- Edit Name Dialog -->
    <el-dialog
      v-model="showEditNameDialog"
      :title="I18nT('common.action.changeName')"
      width="440px"
      :destroy-on-close="true"
    >
      <el-form :model="editNameForm" label-width="110px">
        <el-form-item :label="I18nT('n8n.usersFirstName')">
          <el-input v-model="editNameForm.firstName" />
        </el-form-item>
        <el-form-item :label="I18nT('n8n.usersLastName')">
          <el-input v-model="editNameForm.lastName" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditNameDialog = false">{{ I18nT('base.cancel') }}</el-button>
        <el-button type="primary" :loading="editNameLoading" @click="confirmEditName">{{
          I18nT('base.confirm')
        }}</el-button>
      </template>
    </el-dialog>

    <!-- Change Role Dialog -->
    <el-dialog
      v-model="showChangeRoleDialog"
      :title="I18nT('common.action.changeRole')"
      width="400px"
      :destroy-on-close="true"
    >
      <el-form :model="changeRoleForm" label-width="80px">
        <el-form-item :label="I18nT('n8n.usersRole')">
          <el-select v-model="changeRoleForm.role" style="width: 100%">
            <el-option value="global:member" :label="I18nT('n8n.usersRoleMember')" />
            <el-option value="global:admin" :label="I18nT('n8n.usersRoleAdmin')" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showChangeRoleDialog = false">{{ I18nT('base.cancel') }}</el-button>
        <el-button type="primary" :loading="changeRoleLoading" @click="confirmChangeRole">{{
          I18nT('base.confirm')
        }}</el-button>
      </template>
    </el-dialog>

    <!-- Reset Password Dialog -->
    <el-dialog
      v-model="showResetPasswordDialog"
      :title="I18nT('common.action.resetPassword')"
      width="440px"
      :destroy-on-close="true"
    >
      <el-form :model="resetPasswordForm" label-width="130px">
        <el-form-item :label="I18nT('n8n.usersNewPassword')">
          <el-input v-model="resetPasswordForm.password" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showResetPasswordDialog = false">{{ I18nT('base.cancel') }}</el-button>
        <el-button type="primary" :loading="resetPasswordLoading" @click="confirmResetPassword">{{
          I18nT('base.confirm')
        }}</el-button>
      </template>
    </el-dialog>

    <!-- Add User Dialog -->
    <el-dialog
      v-model="showAddDialog"
      :title="I18nT('n8n.usersAddUser')"
      width="480px"
      :destroy-on-close="true"
    >
      <el-form :model="newUser" label-width="120px">
        <el-form-item :label="I18nT('n8n.usersEmail')">
          <el-input v-model="newUser.email" type="email" />
        </el-form-item>
        <el-form-item :label="I18nT('n8n.usersFirstName')">
          <el-input v-model="newUser.firstName" />
        </el-form-item>
        <el-form-item :label="I18nT('n8n.usersLastName')">
          <el-input v-model="newUser.lastName" />
        </el-form-item>
        <el-form-item :label="I18nT('n8n.usersRole')">
          <el-select v-model="newUser.role" style="width: 100%">
            <el-option value="global:member" :label="I18nT('n8n.usersRoleMember')" />
            <el-option value="global:admin" :label="I18nT('n8n.usersRoleAdmin')" />
          </el-select>
        </el-form-item>
        <el-form-item :label="I18nT('n8n.usersNewPassword')">
          <el-input v-model="newUser.password" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">{{ I18nT('base.cancel') }}</el-button>
        <el-button type="primary" :loading="creating" @click="doCreateUser">
          {{ I18nT('base.confirm') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Invite URL Dialog -->
    <el-dialog
      v-model="showInviteUrlDialog"
      :title="I18nT('n8n.usersInviteUrlTitle')"
      width="560px"
    >
      <p class="text-sm text-gray-500 mb-3">{{ I18nT('n8n.usersInviteUrlTip') }}</p>
      <el-input :model-value="inviteUrl" type="textarea" :rows="3" readonly />
      <template #footer>
        <el-button type="primary" @click="copyInviteUrl">{{
          I18nT('common.action.copy')
        }}</el-button>
        <el-button @click="showInviteUrlDialog = false">{{ I18nT('base.cancel') }}</el-button>
      </template>
    </el-dialog>

    <!-- Change Owner Password Dialog -->
    <el-dialog
      v-model="showChangePasswordDialog"
      :title="I18nT('common.action.changeOwnerPassword')"
      width="480px"
      :destroy-on-close="true"
    >
      <el-form :model="passwordChange" label-width="130px">
        <el-form-item :label="I18nT('n8n.usersNewPassword')">
          <el-input v-model="passwordChange.newPass" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showChangePasswordDialog = false">{{ I18nT('base.cancel') }}</el-button>
        <el-button type="primary" :loading="changingPassword" @click="doChangePassword">
          {{ I18nT('base.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onMounted, ref } from 'vue'
  import { I18nT } from '@lang/index'
  import { MessageWarning } from '@/util/Element'
  import { n8nUsersController as controller, type N8nUser } from './UsersController'

  const dataDir = computed(() => controller.dataDir)
  const users = computed(() => controller.users)
  const scanning = computed(() => controller.pending === 'scan')
  const loading = computed(() => controller.pending === 'load')
  const showScanDialog = ref(false)
  const scanResults = ref<string[]>([])
  const scanSelected = ref('')

  const loadUsers = () => controller.load()
  const chooseDataDir = () => controller.choose()
  const scanDataDir = async () => {
    const paths = await controller.scan()
    if (paths.length === 0) return
    scanResults.value = paths
    scanSelected.value = paths[0]
    showScanDialog.value = true
  }
  const applyScanResult = () => {
    showScanDialog.value = false
    void controller.setDataDir(scanSelected.value)
  }

  const formatRole = (role: string) => {
    if (role === 'global:owner') return I18nT('n8n.usersRoleOwner')
    if (role === 'global:admin') return I18nT('n8n.usersRoleAdmin')
    return I18nT('n8n.usersRoleMember')
  }

  const handleAction = (command: string, user: N8nUser) => {
    if (!controller.canManageUsers) return
    if (command === 'delete') {
      deletingRow.value = user
      showDeleteDialog.value = true
    } else if (command === 'disable' || command === 'enable') {
      void controller.mutate('userSetDisabled', [user.id, command === 'disable'],
        I18nT(command === 'disable' ? 'n8n.usersDisableSuccess' : 'n8n.usersEnableSuccess'))
    } else if (command === 'role') {
      changeRoleRow.value = user
      changeRoleForm.value = { role: user.roleSlug || 'global:member' }
      showChangeRoleDialog.value = true
    } else if (command === 'name') {
      editNameRow.value = user
      editNameForm.value = { firstName: user.firstName ?? '', lastName: user.lastName ?? '' }
      showEditNameDialog.value = true
    } else if (command === 'password') {
      resetPasswordRow.value = user
      resetPasswordForm.value = { password: '' }
      showResetPasswordDialog.value = true
    }
  }

  const showEditNameDialog = ref(false)
  const editNameRow = ref<N8nUser>()
  const editNameForm = ref({ firstName: '', lastName: '' })
  const editNameLoading = computed(() => controller.pending === 'userSetName')
  const confirmEditName = async () => {
    const user = editNameRow.value
    if (!user) return
    const { firstName, lastName } = editNameForm.value
    if (await controller.mutate('userSetName', [user.id, firstName, lastName], I18nT('n8n.usersChangeNameSuccess'))) {
      showEditNameDialog.value = false
    }
  }

  const showChangeRoleDialog = ref(false)
  const changeRoleRow = ref<N8nUser>()
  const changeRoleForm = ref({ role: 'global:member' })
  const changeRoleLoading = computed(() => controller.pending === 'userSetRole')
  const confirmChangeRole = async () => {
    const user = changeRoleRow.value
    if (!user) return
    if (await controller.mutate('userSetRole', [user.id, changeRoleForm.value.role], I18nT('n8n.usersChangeRoleSuccess'))) {
      showChangeRoleDialog.value = false
    }
  }

  const showResetPasswordDialog = ref(false)
  const resetPasswordRow = ref<N8nUser>()
  const resetPasswordForm = ref({ password: '' })
  const resetPasswordLoading = computed(() => controller.pending === 'userResetPassword')
  const requirePassword = (value: string) => {
    if (value) return true
    MessageWarning(I18nT('n8n.usersNewPassword') + ' required')
    return false
  }
  const confirmResetPassword = async () => {
    const user = resetPasswordRow.value
    const { password } = resetPasswordForm.value
    if (!user || !requirePassword(password)) return
    if (await controller.mutate('userResetPassword', [user.id, password], I18nT('n8n.usersResetPasswordSuccess'))) {
      resetPasswordForm.value.password = ''
      showResetPasswordDialog.value = false
    }
  }

  const deletingRow = ref<N8nUser>()
  const deletingId = computed(() => controller.pending === 'userDelete' ? deletingRow.value?.id : undefined)
  const showDeleteDialog = ref(false)
  const confirmDelete = async () => {
    const user = deletingRow.value
    if (!user) return
    if (await controller.mutate('userDelete', [user.id], I18nT('n8n.usersDeleteSuccess'))) {
      showDeleteDialog.value = false
    }
  }

  const freshUser = () => ({ email: '', firstName: '', lastName: '', role: 'global:member', password: '' })
  const showAddDialog = ref(false)
  const creating = computed(() => controller.pending === 'userCreate')
  const newUser = ref(freshUser())
  const showInviteUrlDialog = ref(false)
  const inviteUrl = computed(() => controller.inviteUrl)
  const openAddDialog = () => {
    newUser.value = freshUser()
    showAddDialog.value = true
  }
  const doCreateUser = async () => {
    const { email, firstName, lastName, role, password } = newUser.value
    if (!email) {
      MessageWarning(I18nT('n8n.usersEmail') + ' required')
      return
    }
    if (!requirePassword(password)) return
    if (await controller.mutate('userCreate', [email, firstName, lastName, role, password], I18nT('n8n.usersCreateSuccess'))) {
      newUser.value = freshUser()
      showAddDialog.value = false
      showInviteUrlDialog.value = !!inviteUrl.value
    }
  }
  const copyInviteUrl = () => controller.copyInvite()

  const showChangePasswordDialog = ref(false)
  const changingPassword = computed(() => controller.pending === 'userChangeOwnerPassword')
  const passwordChange = ref({ newPass: '' })
  const openChangePasswordDialog = () => {
    passwordChange.value = { newPass: '' }
    showChangePasswordDialog.value = true
  }
  const doChangePassword = async () => {
    const { newPass } = passwordChange.value
    if (!requirePassword(newPass)) return
    if (await controller.mutate('userChangeOwnerPassword', [newPass], I18nT('n8n.usersChangePasswordSuccess'))) {
      passwordChange.value.newPass = ''
      showChangePasswordDialog.value = false
    }
  }

  onMounted(loadUsers)
</script>
