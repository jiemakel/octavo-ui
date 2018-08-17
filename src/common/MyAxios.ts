import Axios from 'axios'
import Qs from 'qs'

const axios = Axios.create({
  paramsSerializer: params => {
    return Qs.stringify(params, { arrayFormat: 'repeat' })
  }
})

export default axios
