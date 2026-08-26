import { afterEach, describe, expect, it, vi } from 'vitest'
import { scheduleNoticeDismiss } from './notice'

describe('scheduleNoticeDismiss', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('dismisses a visible toast after three seconds', () => {
    vi.useFakeTimers()
    const dismiss = vi.fn()

    const cancel = scheduleNoticeDismiss('分享卡已保存到手机相册', dismiss)

    vi.advanceTimersByTime(2_999)
    expect(dismiss).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(dismiss).toHaveBeenCalledOnce()
    cancel()
  })

  it('does not leave a timer behind when the toast changes or unmounts', () => {
    vi.useFakeTimers()
    const dismiss = vi.fn()

    const cancel = scheduleNoticeDismiss('已暂存在本设备', dismiss)
    cancel()
    vi.advanceTimersByTime(3_000)

    expect(dismiss).not.toHaveBeenCalled()
  })
})
