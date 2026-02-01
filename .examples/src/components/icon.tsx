'use client'

import { cn } from '@/lib/utils'

// logos
import Github from '../../public/logo/github.svg'
import Google from '../../public/logo/google.svg'
import Kakao from '../../public/logo/kakao.svg'
import Logo from '../../public/logo/logo.svg'

export type IconButtonProps = {
  width?: number
  height?: number
  size?: number
  className?: string
  color?: string
  backgroundColor?: string
  disabled?: boolean
  cursor?: string
  onClick?: React.MouseEventHandler<SVGSVGElement>
}

function withIconStyle(
  Icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>,
): React.ComponentType<IconButtonProps> {
  const IconWithStyle = ({
    className,
    size = 24,
    width,
    height,
    cursor,
    disabled,
    onClick,
    color,
    backgroundColor,
    ...rest
  }: IconButtonProps) => {
    let cur = ''
    if (cursor) {
      cur = cursor
    } else {
      cur = onClick ? 'pointer' : ''
    }

    return (
      <div
        style={{
          width: `${width ?? size}px`,
          height: `${height ?? size}px`,
          fontSize: `${width && height ? (width + height) / 2 : size}px`,
          backgroundColor: backgroundColor,
          color: color,
          cursor: disabled ? 'none' : cur,
          opacity: disabled ? 0.1 : 1,
        }}
        className={cn('flex items-center justify-center', className)}
        {...rest}
      >
        <Icon
          fontSize="inherit"
          color="inherit"
          onClick={onClick as React.MouseEventHandler<SVGSVGElement>}
        />
      </div>
    )
  }

  return IconWithStyle
}

// logos
export const GithubIcon = withIconStyle(Github)
export const GoogleIcon = withIconStyle(Google)
export const KakaoIcon = withIconStyle(Kakao)
export const LogoIcon = withIconStyle(Logo)
