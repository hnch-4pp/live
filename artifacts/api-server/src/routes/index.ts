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

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(stripeRouter);
router.use(subscriptionsRouter);
router.use(placesRouter);
router.use(storageRouter);
router.use(notificationsRouter);
router.use(hunchesRouter);
router.use(categoriesRouter);
router.use(adminRouter);

export default router;
