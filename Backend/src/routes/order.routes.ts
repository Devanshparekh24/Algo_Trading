// ---------------------------------------------------------------------------
// Order Routes – Official Angel One Order API v1 Routing
// ---------------------------------------------------------------------------

import { Router } from "express";
import {
  placeOrderController,
  modifyOrderController,
  cancelOrderController,
  getOrderBookController,
  getTradeBookController,
  getLtpDataController,
  getIndividualOrderDetailsController,
} from "../controllers/order.controller.js";

const router = Router();

// 1. Place Order
// POST /placeOrder and alias /place
router.post("/placeOrder", placeOrderController);
router.post("/place", placeOrderController);

// 2. Modify Order
// POST /modifyOrder and alias /modify
router.post("/modifyOrder", modifyOrderController);
router.post("/modify", modifyOrderController);

// 3. Cancel Order
// POST /cancelOrder and alias /cancel
router.post("/cancelOrder", cancelOrderController);
router.post("/cancel", cancelOrderController);

// 4. Get Order Book
// GET /getOrderBook and alias /book, /
router.get("/getOrderBook", getOrderBookController);
router.get("/book", getOrderBookController);
router.get("/", getOrderBookController);

// 5. Get Trade Book
// GET /getTradeBook and alias /trades
router.get("/getTradeBook", getTradeBookController);
router.get("/trades", getTradeBookController);

// 6. Get LTP Data
// POST /getLtpData and alias /ltp
router.post("/getLtpData", getLtpDataController);
router.post("/ltp", getLtpDataController);

// 7. Individual Order Status by Unique Order ID
// GET /details/:uniqueorderid and alias /:uniqueorderid
router.get("/details/:uniqueorderid", getIndividualOrderDetailsController);
router.get("/:uniqueorderid", getIndividualOrderDetailsController);

export default router;

