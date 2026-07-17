import { createMasterDataHooks } from './useMasterData'
export const { useList: useCommercialModels, useCreate: useCreateCommercialModel, useDelete: useDeleteCommercialModel } = createMasterDataHooks('commercial-models', 'commercial-models')
