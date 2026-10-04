-- CPV SQLite fixtures (non-production). Runtime app uses the in-memory CPV service until Supabase.

DELETE FROM cpv_recommendations;
DELETE FROM cpv_improvements;
DELETE FROM cpv_event_batch_links;
DELETE FROM cpv_linked_events;
DELETE FROM cpv_hold_time_records;
DELETE FROM cpv_hold_time_requirements;
DELETE FROM cpv_stability_time_points;
DELETE FROM cpv_stability_studies;
DELETE FROM cpv_test_results;
DELETE FROM cpv_test_definitions;
DELETE FROM cpv_asset_uses;
DELETE FROM cpv_assets;
DELETE FROM cpv_material_usages;
DELETE FROM cpv_material_definitions;
DELETE FROM cpv_audit_events;
DELETE FROM cpv_reports;
DELETE FROM cpv_protocols;
DELETE FROM cpv_packaging_orders;
DELETE FROM cpv_product_batches;
DELETE FROM cpv_products;
