import { createMasterDataRouter } from '../lib/masterDataRouter'
import prisma from '../lib/prisma'

export default createMasterDataRouter(prisma.commercialModel, 'lead')
