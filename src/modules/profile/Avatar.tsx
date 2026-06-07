import { avatarSrc, initialsOf, type Profile } from "./api";

type Props = {
  profile: Pick<
    Profile,
    "id" | "displayName" | "avatarColor" | "hasAvatar" | "avatarUpdatedAt"
  >;
  size?: number;
  className?: string;
};

/** Square rounded avatar: uploaded image when present, else a colored badge. */
export function Avatar({ profile, size = 28, className = "" }: Props) {
  const src = avatarSrc(profile as Profile);
  const style = { width: size, height: size } as const;
  if (src) {
    return (
      <img
        src={src}
        alt={profile.displayName}
        width={size}
        height={size}
        style={style}
        className={`shrink-0 rounded-md object-cover ${className}`}
      />
    );
  }
  return (
    <div
      style={{ ...style, backgroundColor: profile.avatarColor, fontSize: size * 0.4 }}
      className={`flex shrink-0 items-center justify-center rounded-md font-semibold text-white select-none ${className}`}
      aria-label={profile.displayName}
    >
      {initialsOf(profile)}
    </div>
  );
}
