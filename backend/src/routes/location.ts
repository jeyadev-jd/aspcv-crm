import { Router } from 'express'
import { authenticate } from '../middleware/auth'

const router = Router()
router.use(authenticate)

// Location is now manual entry — these endpoints return static India state list only
const INDIA_STATES = [
  'None', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Chandigarh', 'Puducherry', 'Jammu & Kashmir', 'Ladakh',
]

router.get('/states', (_req, res) => res.json(INDIA_STATES))

export default router
