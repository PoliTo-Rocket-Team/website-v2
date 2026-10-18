import { AvatarProps } from "@radix-ui/react-avatar";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MarkFallback } from "@/components/mark-fallback";

interface UserAvatarProps extends AvatarProps {
  user: { name: string; image: string; email: string };
}

export function UserAvatar({ user, ...props }: UserAvatarProps) {
  return (
    <Avatar {...props}>
      {user.image ? (
        <AvatarImage alt="Picture" src={user.image} />
      ) : (
        <AvatarFallback>
          <span className="sr-only">{user.name}</span>
          <MarkFallback />
        </AvatarFallback>
      )}
    </Avatar>
  )
} 