export type EmotionType = 
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'thinking'
  | 'confused'
  | 'excited'
  | 'shy'
  | 'worried'

export interface EmotionConfig {
  type: EmotionType
  intensity: number
  duration?: number
}

export interface Live2DExpressionParams {
  ParamEyeLOpen?: number
  ParamEyeROpen?: number
  ParamEyeLSmile?: number
  ParamEyeRSmile?: number
  ParamBrowLForm?: number
  ParamBrowRForm?: number
  ParamMouthForm?: number
  ParamMouthOpenY?: number
  ParamCheek?: number
  ParamAngleX?: number
  ParamAngleY?: number
}

export interface EmotionMapping {
  emotion: EmotionType
  params: Live2DExpressionParams
  transitionDuration: number
  description: string
}

export const EMOTION_KEYWORDS: Record<EmotionType, string[]> = {
  neutral: [],
  happy: ['开心', '高兴', '快乐', '喜欢', '棒', '好', '太好了', '哈哈', '嘻嘻', '😊', '😄', '😀', 'happy', 'great', 'wonderful', 'excellent'],
  sad: ['难过', '伤心', '遗憾', '可惜', '抱歉', '😢', '😭', '😔', 'sad', 'sorry', 'unfortunately'],
  angry: ['生气', '愤怒', '讨厌', '烦', '😠', '😡', 'angry', 'upset'],
  surprised: ['哇', '惊讶', '意外', '没想到', '天哪', '😲', '😮', 'wow', 'surprised', 'amazing'],
  thinking: ['嗯...', '让我想想', '思考', '考虑', '🤔', 'thinking', 'hmm', 'let me think'],
  confused: ['困惑', '不明白', '不懂', '什么意思', '😕', '❓', 'confused', 'what do you mean'],
  excited: ['太棒了', '兴奋', '期待', '激动', '🎉', '✨', 'excited', 'awesome', 'can\'t wait'],
  shy: ['害羞', '不好意思', '脸红', '😳', '🙈', 'shy', 'embarrassed'],
  worried: ['担心', '忧虑', '不安', '焦虑', '😟', '😰', 'worried', 'concerned']
}

export const EMOTION_MAPPINGS: Record<EmotionType, EmotionMapping> = {
  neutral: {
    emotion: 'neutral',
    params: {
      ParamEyeLOpen: 1,
      ParamEyeROpen: 1,
      ParamEyeLSmile: 0,
      ParamEyeRSmile: 0,
      ParamBrowLForm: 0,
      ParamBrowRForm: 0,
      ParamMouthForm: 0,
      ParamMouthOpenY: 0,
      ParamCheek: 0
    },
    transitionDuration: 300,
    description: '中性表情'
  },
  happy: {
    emotion: 'happy',
    params: {
      ParamEyeLOpen: 0.8,
      ParamEyeROpen: 0.8,
      ParamEyeLSmile: 1,
      ParamEyeRSmile: 1,
      ParamBrowLForm: 0.5,
      ParamBrowRForm: 0.5,
      ParamMouthForm: 1,
      ParamMouthOpenY: 0.2,
      ParamCheek: 0.6
    },
    transitionDuration: 400,
    description: '开心表情'
  },
  sad: {
    emotion: 'sad',
    params: {
      ParamEyeLOpen: 0.5,
      ParamEyeROpen: 0.5,
      ParamEyeLSmile: 0,
      ParamEyeRSmile: 0,
      ParamBrowLForm: -0.5,
      ParamBrowRForm: -0.5,
      ParamMouthForm: -0.5,
      ParamMouthOpenY: 0,
      ParamCheek: 0
    },
    transitionDuration: 500,
    description: '难过表情'
  },
  angry: {
    emotion: 'angry',
    params: {
      ParamEyeLOpen: 0.7,
      ParamEyeROpen: 0.7,
      ParamEyeLSmile: 0,
      ParamEyeRSmile: 0,
      ParamBrowLForm: -0.8,
      ParamBrowRForm: -0.8,
      ParamMouthForm: -0.3,
      ParamMouthOpenY: 0,
      ParamCheek: 0
    },
    transitionDuration: 200,
    description: '生气表情'
  },
  surprised: {
    emotion: 'surprised',
    params: {
      ParamEyeLOpen: 1.5,
      ParamEyeROpen: 1.5,
      ParamEyeLSmile: 0,
      ParamEyeRSmile: 0,
      ParamBrowLForm: 0.8,
      ParamBrowRForm: 0.8,
      ParamMouthForm: 0,
      ParamMouthOpenY: 0.8,
      ParamCheek: 0
    },
    transitionDuration: 150,
    description: '惊讶表情'
  },
  thinking: {
    emotion: 'thinking',
    params: {
      ParamEyeLOpen: 0.6,
      ParamEyeROpen: 0.6,
      ParamEyeLSmile: 0,
      ParamEyeRSmile: 0,
      ParamBrowLForm: 0.3,
      ParamBrowRForm: 0.3,
      ParamMouthForm: 0,
      ParamMouthOpenY: 0,
      ParamCheek: 0,
      ParamAngleX: -0.3
    },
    transitionDuration: 400,
    description: '思考表情'
  },
  confused: {
    emotion: 'confused',
    params: {
      ParamEyeLOpen: 0.8,
      ParamEyeROpen: 0.8,
      ParamEyeLSmile: 0,
      ParamEyeRSmile: 0,
      ParamBrowLForm: 0.5,
      ParamBrowRForm: -0.3,
      ParamMouthForm: -0.2,
      ParamMouthOpenY: 0,
      ParamCheek: 0
    },
    transitionDuration: 300,
    description: '困惑表情'
  },
  excited: {
    emotion: 'excited',
    params: {
      ParamEyeLOpen: 1.2,
      ParamEyeROpen: 1.2,
      ParamEyeLSmile: 1,
      ParamEyeRSmile: 1,
      ParamBrowLForm: 0.8,
      ParamBrowRForm: 0.8,
      ParamMouthForm: 1,
      ParamMouthOpenY: 0.5,
      ParamCheek: 0.8
    },
    transitionDuration: 300,
    description: '兴奋表情'
  },
  shy: {
    emotion: 'shy',
    params: {
      ParamEyeLOpen: 0.4,
      ParamEyeROpen: 0.4,
      ParamEyeLSmile: 0.3,
      ParamEyeRSmile: 0.3,
      ParamBrowLForm: 0.2,
      ParamBrowRForm: 0.2,
      ParamMouthForm: 0.3,
      ParamMouthOpenY: 0,
      ParamCheek: 1,
      ParamAngleX: 0.3
    },
    transitionDuration: 400,
    description: '害羞表情'
  },
  worried: {
    emotion: 'worried',
    params: {
      ParamEyeLOpen: 0.6,
      ParamEyeROpen: 0.6,
      ParamEyeLSmile: 0,
      ParamEyeRSmile: 0,
      ParamBrowLForm: -0.3,
      ParamBrowRForm: -0.3,
      ParamMouthForm: -0.3,
      ParamMouthOpenY: 0,
      ParamCheek: 0
    },
    transitionDuration: 400,
    description: '担心表情'
  }
}
