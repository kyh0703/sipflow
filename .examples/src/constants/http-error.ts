enum ErrorCode {
  // API
  HEADER_NO_TOKEN = 4000,
  UNKNOWN_TOKEN = 4001,
  UNKNOWN_USER = 4002,
  CREATE_TOKEN_FAIL = 4003,
  TOKEN_PARSING_FAIL = 4004,
  EXIST_NOT_FLOW_INFO = 4005,
  ACCESS_TOKEN_EXPIRED = 4006,
  REFRESH_TOKEN_EXPIRED = 4007,
  DELETE_MAIN_END_LIMITED = 4008,
  DELETE_START_LIMITED = 4009,
  FLOW_DATA_DUPLICATE = 4010,
  INTERFACE_PARSING_ERROR = 4012,
  PROPERTY_KEY_NOT_EXIST = 4013,
  EXIST_NOT_DEFINED_TYPE = 4014,
  DEFINE_MENU_ERROR = 4025,
  DB_TOKEN_NOT_FOUND = 4302,
  SUB_FLOW_DUPLICATE_NAME = 4303,
}

const errorMessages = new Map<ErrorCode, string>([
  [ErrorCode.ACCESS_TOKEN_EXPIRED, 'Access Token Expired'],
  [
    ErrorCode.DEFINE_MENU_ERROR,
    'Define Menu에서 Open한 SubFlow는 Return을 사용할 수 없다.',
  ],
  [ErrorCode.REFRESH_TOKEN_EXPIRED, 'Refresh Token Expired'],
  [ErrorCode.DB_TOKEN_NOT_FOUND, 'DB / backend memory token not found'],
  [ErrorCode.HEADER_NO_TOKEN, 'Header have no token'],
  [ErrorCode.UNKNOWN_TOKEN, 'Unknown Token'],
  [ErrorCode.UNKNOWN_USER, 'Unknown User'],
  [ErrorCode.CREATE_TOKEN_FAIL, 'Create Token Fail'],
  [ErrorCode.TOKEN_PARSING_FAIL, 'Token Parsing Fail'],
  [ErrorCode.EXIST_NOT_FLOW_INFO, 'Exist Not FlowInfo'],
  [ErrorCode.DELETE_MAIN_END_LIMITED, 'Delete Main/End Limited'],
  [ErrorCode.DELETE_START_LIMITED, 'Delete Start Limited'],
  [ErrorCode.FLOW_DATA_DUPLICATE, 'FlowData Duplicate'],
  [ErrorCode.INTERFACE_PARSING_ERROR, 'Interface Parsing Error'],
  [ErrorCode.PROPERTY_KEY_NOT_EXIST, 'Not Exist Property Key'],
  [ErrorCode.EXIST_NOT_DEFINED_TYPE, 'Exist Not Define Type'],
  [ErrorCode.SUB_FLOW_DUPLICATE_NAME, 'SubFlow or CommSubFlow Duplicate Name'],
])

export { ErrorCode, errorMessages }
