import { createMasterDataHooks } from './useMasterData'
export const { useList: useCountries, useCreate: useCreateCountry, useDelete: useDeleteCountry } = createMasterDataHooks('countries', 'countries')
