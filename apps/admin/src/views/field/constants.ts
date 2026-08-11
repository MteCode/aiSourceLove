/** 字段类型的中文名。只在后台配置页用到，不必进 shared */
export const FIELD_TYPE_LABEL: Record<string, string> = {
  TEXT: '单行文本',
  TEXTAREA: '多行文本',
  NUMBER: '数字',
  SELECT: '单选',
  MULTI_SELECT: '多选',
  DATE: '日期',
  REGION: '省市区',
  BOOLEAN: '是否',
  IMAGE: '单图',
  IMAGES: '多图',
  RANGE: '数值区间',
};

/** 带选项的类型才需要配置 options */
export const OPTION_TYPES = ['SELECT', 'MULTI_SELECT'];
