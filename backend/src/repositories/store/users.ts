/** User accounts, preferences, and actor helpers. */
import { product } from "@/shared/product";
import type { Actor, Preferences, UserAccount } from "@/domain/types";
import { AppError } from "@/http";
import { audit, emptyPreferences, proUntil } from "@/repositories/db";


import type { StoreCore } from "@/repositories/store/store-core";

type Ctor<T = StoreCore> = new (...args: any[]) => T;

export function WithUsers<TBase extends Ctor>(Base: TBase) {
  return class extends Base {
  createUser(input: {
    email: string;
    displayName: string;
    adultConfirmed: boolean;
    referralCode?: string | null;
    cookieId?: string | null;
    now?: Date;
  }): UserAccount {
    const now = input.now ?? new Date();
    if (!input.adultConfirmed) {
      throw new AppError(422, "age_required", "Pikajobs is for adults aged 18 and over.");
    }
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError(422, "invalid_email", "Enter a valid email.");
    }
    if (this.db.users.some((user) => user.email === email && !user.deletedAt)) {
      throw new AppError(409, "account_exists", "An account with this email already exists. Sign in instead.");
    }
    const user: UserAccount = {
      userId: crypto.randomUUID(),
      email,
      displayName: input.displayName.trim().slice(0, 80) || email.split("@")[0],
      countryCode: "IN",
      currentStage: "",
      onboardingStep: 0,
      onboardingCompleted: false,
      adultConfirmed: true,
      roles: [],
      suspended: false,
      createdAt: now.toISOString(),
      deletedAt: null,
      referralCode: null,
      referralTermsAcceptedAt: null,
    };
    if (email === product.adminEmail && !this.db.bootstrapConsumed) {
      user.roles = ["admin", "finance"];
      this.db.bootstrapConsumed = true;
      audit(this.db, user.userId, "bootstrap_admin", user.userId, "Bound the initial admin.", now.toISOString());
    }
    this.db.users.push(user);
    this.db.preferences.push(emptyPreferences(user.userId, now.toISOString()));
    this.attributeNewUser(user, input.referralCode, input.cookieId, now);
    return user;
  }

  /** Sync a Supabase Auth user into the local domain store (same UUID). */

  ensureAuthUser(input: {
    userId: string;
    email: string;
    displayName: string;
    adultConfirmed: boolean;
    roles: string[];
    referralCode?: string | null;
    now?: Date;
  }): UserAccount {
    const now = input.now ?? new Date();
    const email = input.email.trim().toLowerCase();
    let user = this.db.users.find((item) => item.userId === input.userId && !item.deletedAt);
    if (!user) {
      const byEmail = this.db.users.find((item) => item.email === email && !item.deletedAt);
      if (byEmail) {
        const oldId = byEmail.userId;
        byEmail.userId = input.userId;
        for (const prefs of this.db.preferences) {
          if (prefs.userId === oldId) prefs.userId = input.userId;
        }
        user = byEmail;
      } else {
        user = {
          userId: input.userId,
          email,
          displayName: input.displayName.trim().slice(0, 80) || email.split("@")[0],
          countryCode: "IN",
          currentStage: "",
          onboardingStep: 0,
          onboardingCompleted: false,
          adultConfirmed: input.adultConfirmed,
          roles: [...input.roles],
          suspended: false,
          createdAt: now.toISOString(),
          deletedAt: null,
          referralCode: null,
          referralTermsAcceptedAt: null,
        };
        this.db.users.push(user);
        this.db.preferences.push(emptyPreferences(user.userId, now.toISOString()));
        this.attributeNewUser(user, input.referralCode, null, now);
      }
    }
    user.email = email;
    user.displayName = input.displayName.trim().slice(0, 80) || user.displayName;
    user.adultConfirmed = input.adultConfirmed;
    user.roles = [...input.roles];
    return user;
  }

  actorFor(userId: string, now = new Date()): Actor {
    const user = this.db.users.find((item) => item.userId === userId && !item.deletedAt);
    if (!user) return { kind: "anonymous" };
    return {
      kind: "user",
      userId: user.userId,
      email: user.email,
      roles: [...user.roles],
      proUntil: proUntil(this.db, user.userId),
      suspended: user.suspended,
    };
  }

  updateAccount(
    actor: Actor,
    patch: { displayName?: string; countryCode?: string; currentStage?: string },
  ): UserAccount {
    const user = this.user(actor);
    if (patch.displayName != null) user.displayName = patch.displayName.trim().slice(0, 80);
    if (patch.countryCode != null) user.countryCode = patch.countryCode.trim().slice(0, 8) || "IN";
    if (patch.currentStage != null) user.currentStage = patch.currentStage.slice(0, 80);
    return user;
  }

  savePreferences(actor: Actor, patch: Partial<Preferences> & { step?: number; complete?: boolean }, now = new Date()): Preferences {
    const user = this.user(actor);
    const prefs = this.prefs(user.userId, now);
    const allow: (keyof Preferences)[] = [
      "opportunityKinds",
      "sectors",
      "roleFamilySlugs",
      "skillSlugs",
      "workModes",
      "locationLabel",
      "countryCode",
      "experienceBand",
      "stage",
      "showUnknownPay",
      "jobPayTargetMinor",
      "internshipPayTargetMinor",
      "otherRoleNote",
    ];
    for (const key of allow) {
      if (patch[key] !== undefined) {
        (prefs as unknown as Record<string, unknown>)[key] = patch[key];
      }
    }
    prefs.skillSlugs = prefs.skillSlugs.slice(0, 10);
    prefs.otherRoleNote = prefs.otherRoleNote.slice(0, 80);
    prefs.updatedAt = now.toISOString();
    if (patch.step != null) user.onboardingStep = patch.step;
    if (patch.complete) user.onboardingCompleted = true;
    if (patch.stage) user.currentStage = patch.stage;
    return prefs;
  }

  getPreferences(actor: Actor): Preferences {
    const user = this.user(actor);
    return this.prefs(user.userId, new Date());
  }

  account(actor: Actor) {
    const user = this.user(actor);
    return { ...user, proUntil: proUntil(this.db, user.userId), preferences: this.prefs(user.userId, new Date()) };
  }

  protected attributeNewUser(user: UserAccount, explicitCode: string | null | undefined, cookieId: string | null | undefined, now: Date) {
    const touch = cookieId ? this.db.touches.find((item) => item.cookieId === cookieId) : undefined;
    const code = explicitCode || touch?.code;
    if (touch && now.getTime() - new Date(touch.capturedAt).getTime() > product.attributionWindowDays * 86400000 && !explicitCode) return;
    if (!code) return;
    const referrer = this.db.users.find((item) => item.referralCode === code && item.referralTermsAcceptedAt);
    if (!referrer || referrer.userId === user.userId || referrer.email === user.email) return;
    if (this.db.attributions.some((item) => item.referredUserId === user.userId)) return;
    this.db.attributions.push({ referredUserId: user.userId, referrerUserId: referrer.userId, code, linkedAt: now.toISOString() });
  }
  };
}
