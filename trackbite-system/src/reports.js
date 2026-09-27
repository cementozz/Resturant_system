const { all, one } = require('./db');
function todayReport() {
  const sales=one(`SELECT COUNT(*) orders_count, COALESCE(SUM(total),0) total_sales, COALESCE(AVG(total),0) avg_order FROM orders WHERE status='completed' AND date(created_at,'localtime')=date('now','localtime')`);
  const payments=all(`SELECT pm.id,pm.code,pm.name_ar,pm.name_en,COALESCE(SUM(p.amount),0) amount FROM payment_methods pm LEFT JOIN payments p ON p.payment_method_id=pm.id AND date(p.created_at,'localtime')=date('now','localtime') WHERE pm.active=1 GROUP BY pm.id ORDER BY pm.sort_order,pm.id`);
  const top=all(`SELECT oi.product_name_ar,oi.product_name_en,SUM(oi.quantity) qty,SUM(oi.line_total) sales FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status='completed' AND date(o.created_at,'localtime')=date('now','localtime') GROUP BY oi.product_id ORDER BY qty DESC LIMIT 10`);
  const waste=one(`SELECT COALESCE(SUM(quantity_base),0) qty FROM waste_records WHERE date(created_at,'localtime')=date('now','localtime')`);
  return {sales,payments,top,waste};
}
module.exports={todayReport};
