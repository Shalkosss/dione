---
name: orden
description: Registra en el libro de órdenes de DIONE (Supabase) una compra o venta que el usuario dice que hizo, por ejemplo "compré 10 JMKE a 100", "vendí la mitad de NU a 12.5" o "/orden buy MU 5 720". Usar siempre que el usuario reporte una operación ejecutada.
---

# Registrar una orden

1. Sacar del mensaje: lado (compra o venta), ticker, cantidad de acciones, precio, cuenta
   (`real` o `paper`), fecha, y stop o take profit si los dio.
   - Si falta la cantidad o el precio, preguntar. No inventarlos. Si dice "a 100 dólares" y no
     queda claro si es el precio o el monto total, preguntar.
   - Si dice un monto en dólares en vez de acciones, cantidad = monto / precio (se permiten fracciones).
   - "La mitad", "todo": leer la posición actual con `--check` primero y calcular.
   - Cuenta: si no la dice, preguntar una vez. La competencia y las pruebas van a `paper`.
   - Fecha: hoy en Lima, salvo que diga otra.
2. Validar sin escribir:
   `npm run ledger:order -- buy JMKE 10 --price 100 --account real --check`
   (opcionales: `--date AAAA-MM-DD --stop 92 --target 120 --note "..."`).
3. Si pasa, registrar con el mismo comando sin `--check`.
4. Responder en dos líneas: qué quedó registrado y la caja que queda. Si es una compra de una
   tesis viva, mencionar su stop y objetivo. El navegador lo adopta al sincronizar; si muestra
   conflicto, elegir "usar Supabase".
