/*
 * The platform chrome the desk wears: where a window's controls sit and what they look like, how the
 * title bar, dock and menu bar are drawn. Separate from `data-theme`, which is light or dark — the two
 * combine freely.
 *
 * A look is chrome, not brand: it never sets the accent or the ground, which are the app's.
 *
 * It is not the keyboard either. Somebody on a Mac who prefers the GNOME look still presses ⌘, so
 * shortcuts read the device through `isApplePlatform`, never through the look.
 */
export type Look = 'mac' | 'gnome' | 'windows'

/** What an app asks for: a look, or `auto` for the one that matches the device. */
export type LookChoice = Look | 'auto'

/**
 * The look for a device, from its platform string and user agent. A device it does not recognise
 * gets `mac`, which is how desk looked before it had looks.
 */
export function lookFor(platform: string, userAgent: string): Look {
  // Android reports a Linux platform, and is not a Linux desktop.
  if (/android/i.test(userAgent)) return 'mac'
  const device = `${platform} ${userAgent}`
  if (/mac|iphone|ipad|ipod|ios/i.test(device)) return 'mac'
  if (/win/i.test(device)) return 'windows'
  if (/linux|cros|chrome os|x11|bsd/i.test(device)) return 'gnome'
  return 'mac'
}

interface NavigatorWithHints {
  readonly platform?: string
  readonly userAgent?: string
  readonly userAgentData?: { readonly platform?: string }
}

/** The look for the device this is running on; `mac` where there is no navigator to ask. */
export function deviceLook(): Look {
  if (typeof navigator === 'undefined') return 'mac'
  const hints = navigator as NavigatorWithHints
  return lookFor(hints.userAgentData?.platform || hints.platform || '', hints.userAgent ?? '')
}

export const resolveLook = (choice: LookChoice): Look => (choice === 'auto' ? deviceLook() : choice)
