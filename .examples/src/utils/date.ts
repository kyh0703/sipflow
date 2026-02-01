/**
 * 상대 시간을 한국어로 포맷팅하는 함수
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMinutes < 1) {
    return '방금 전'
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes}분 전`
  } else if (diffInHours < 24) {
    return `${diffInHours}시간 전`
  } else if (diffInDays < 7) {
    return `${diffInDays}일 전`
  } else {
    // 일주일 이상 지난 경우 날짜 표시
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }
}