import Notification from '../models/Notification';
import { maybeSendNotificationEmail } from './notifyEmail';

let patched = false;

/**
 * insertMany does not run document `save` hooks; patch so optional SMTP emails still go out.
 * Idempotent; runs once on module load.
 */
export function patchNotificationInsertManyForEmail(): void {
  if (patched) return;
  patched = true;

  const Model = Notification;
  const origInsertMany = Model.insertMany.bind(Model) as (
    ...a: unknown[]
  ) => Promise<unknown>;

  (Model as unknown as { insertMany: typeof origInsertMany }).insertMany =
    async function insertManyWithOptionalEmail(
      ...args: unknown[]
    ): Promise<unknown> {
    const res = await origInsertMany(...args);
    const options = args[1] as { rawResult?: boolean } | undefined;
    if (options?.rawResult) {
      return res;
    }

    const list = Array.isArray(res) ? res : [];
    for (const d of list) {
      const o =
        d && typeof (d as { toObject?: () => Record<string, unknown> }).toObject === 'function'
          ? (d as { toObject: () => Record<string, unknown> }).toObject()
          : (d as Record<string, unknown>);
      if (o?.user && o?.title) {
        void maybeSendNotificationEmail({
          user: o.user,
          title: String(o.title),
          body: String(o.body ?? ''),
          link: String(o.link ?? ''),
          type: String(o.type ?? ''),
        });
      }
    }

    return res;
  };
}

patchNotificationInsertManyForEmail();
