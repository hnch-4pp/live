import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hunchesRouter from "./hunches";
import categoriesRouter from "./categories";
import adminRouter from "./admin";
import authRouter from "./auth";
import placesRouter from "./places";
import storageRouter from "./storage";
import stripeRouter from "./stripe";
import subscriptionsRouter from "./subscriptions";
import notificationsRouter from "./notifications";
import userNotificationsRouter from "./user-notifications";
import affiliatesRouter from "./affiliates";
import usersRouter from "./users";
import commentsRouter from "./comments";
import bugReportsRouter from "./bug-reports";
import suggestHunchRouter from "./suggest-hunch";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(commentsRouter);
router.use(authRouter);
router.use(stripeRouter);
router.use(subscriptionsRouter);
router.use(placesRouter);
router.use(storageRouter);
router.use(notificationsRouter);
router.use(userNotificationsRouter);
router.use(affiliatesRouter);
router.use(hunchesRouter);
router.use(categoriesRouter);
router.use(adminRouter);
router.use(bugReportsRouter);
router.use(suggestHunchRouter);

export default router;
