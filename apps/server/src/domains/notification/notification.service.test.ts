import { describe, expect, it, mock } from "bun:test";
import NotificationService from "./notification.service";

type Preferences = {
  appPosts: boolean;
  appFollowers: boolean;
  appScheduled: boolean;
  appReplies: boolean;
  emailDigest: boolean;
  emailFollowers: boolean;
  emailNews: boolean;
};

function makeService(
  preferences: Preferences,
  create = mock(async () => true),
) {
  const service = new NotificationService();
  // @ts-ignore — isolate preference-gated service behavior
  service.userRepo = {
    getNotificationSettings: mock(
      async () => new Map([["recipient-1", preferences]]),
    ),
  };
  // @ts-ignore
  service.notificationRepo = { create };
  return { service, create };
}

describe("NotificationService — saved in-app preferences", () => {
  it("does not create scheduled-publish alerts when disabled", async () => {
    const { service, create } = makeService({
      appPosts: true,
      appFollowers: true,
      appScheduled: false,
      appReplies: true,
      emailDigest: false,
      emailFollowers: false,
      emailNews: false,
    });

    await service.notifyScheduledPostPublished("recipient-1", "blog-1");

    expect(create).not.toHaveBeenCalled();
  });

  it("creates scheduled-publish alerts when enabled", async () => {
    const { service, create } = makeService({
      appPosts: true,
      appFollowers: true,
      appScheduled: true,
      appReplies: true,
      emailDigest: false,
      emailFollowers: false,
      emailNews: false,
    });

    await service.notifyScheduledPostPublished("recipient-1", "blog-1");

    expect(create).toHaveBeenCalledWith({
      recipientId: "recipient-1",
      actorId: "recipient-1",
      blogId: "blog-1",
      type: "scheduled_post_published",
      eventKey: "scheduled-publish:blog-1",
    });
  });

  it("gates comment replies with the reply preference", async () => {
    const { service, create } = makeService({
      appPosts: true,
      appFollowers: true,
      appScheduled: true,
      appReplies: false,
      emailDigest: false,
      emailFollowers: false,
      emailNews: false,
    });

    await service.notifyCommentReply(
      "recipient-1",
      "actor-1",
      "blog-1",
      "comment-1",
    );

    expect(create).not.toHaveBeenCalled();
  });
});
