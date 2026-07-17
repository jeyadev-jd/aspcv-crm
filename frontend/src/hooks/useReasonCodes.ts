import { createMasterDataHooks } from './useMasterData'
export const { useList: useReasonCodes, useCreate: useCreateReasonCode, useDelete: useDeleteReasonCode } = createMasterDataHooks('reason-codes', 'reason-codes')
