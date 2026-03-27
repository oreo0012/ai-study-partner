import { describe, it, expect } from 'vitest'

describe('checkAnswerCorrectness', () => {
  const correctIndicators = [
    '正确',
    '对了',
    '答对了',
    '算对了',
    '做对了',
    '完全正确',
    '完全对',
    '答得对',
    '✅',
    '✓',
    '√',
    '对的',
    '是对的'
  ]
  
  const wrongIndicators = [
    '有些问题',
    '不对',
    '差一点',
    '算错了',
    '不太对',
    '不正确',
    '❌',
    '✗',
    '有点问题'
  ]

  function checkAnswerCorrectness(response: string): boolean {
    const lowerResponse = response.toLowerCase()
    
    for (const indicator of wrongIndicators) {
      if (lowerResponse.includes(indicator.toLowerCase())) {
        return false
      }
    }
    
    for (const indicator of correctIndicators) {
      if (lowerResponse.includes(indicator.toLowerCase())) {
        return true
      }
    }
    
    return false
  }

  it('应识别 "正确" 为正确', () => {
    expect(checkAnswerCorrectness('你的答案正确！')).toBe(true)
  })

  it('应识别 "对了" 为正确', () => {
    expect(checkAnswerCorrectness('你对了！')).toBe(true)
  })

  it('应识别 "答对了" 为正确', () => {
    expect(checkAnswerCorrectness('真棒！你答对了！')).toBe(true)
  })

  it('应识别 "算对了" 为正确 - 这是原bug案例', () => {
    expect(checkAnswerCorrectness('真棒！你算对了！36 ÷ 6 = 6 ✓')).toBe(true)
  })

  it('应识别 "做对了" 为正确', () => {
    expect(checkAnswerCorrectness('你做对了！')).toBe(true)
  })

  it('应识别 ✓ 符号为正确', () => {
    expect(checkAnswerCorrectness('36 ÷ 6 = 6 ✓')).toBe(true)
  })

  it('应识别 ✅ 符号为正确', () => {
    expect(checkAnswerCorrectness('答案 ✅')).toBe(true)
  })

  it('应识别 √ 符号为正确', () => {
    expect(checkAnswerCorrectness('答案 √')).toBe(true)
  })

  it('应识别 "有些问题" 为错误', () => {
    expect(checkAnswerCorrectness('这道题有些问题')).toBe(false)
  })

  it('应识别 "不对" 为错误', () => {
    expect(checkAnswerCorrectness('答案不太对')).toBe(false)
  })

  it('应识别 "差一点" 为错误', () => {
    expect(checkAnswerCorrectness('差一点就对了')).toBe(false)
  })

  it('应识别 ❌ 符号为错误', () => {
    expect(checkAnswerCorrectness('答案 ❌')).toBe(false)
  })

  it('应优先识别错误指示符', () => {
    expect(checkAnswerCorrectness('这道题你答对了，但那道题不太对')).toBe(false)
  })

  it('应返回 false 当没有匹配时', () => {
    expect(checkAnswerCorrectness('这是一段普通的文字')).toBe(false)
  })

  it('应处理复杂的反馈文本 - 正确案例', () => {
    const feedback = '真棒！你算对了！36 ÷ 6 = 6 ✓\n\n你可以这样想：6 × 6 =36，所以36 ÷ 6 = 6。继续加油！🌟'
    expect(checkAnswerCorrectness(feedback)).toBe(true)
  })

  it('应处理复杂的反馈文本 - 错误案例', () => {
    const feedback = '这道题有点问题，正确答案是7。\n\n你可以这样想：49 ÷ 7 = 7，因为7 × 7 = 49。加油！'
    expect(checkAnswerCorrectness(feedback)).toBe(false)
  })
})
