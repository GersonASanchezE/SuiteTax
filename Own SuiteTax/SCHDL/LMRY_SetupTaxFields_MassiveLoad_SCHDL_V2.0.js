/**
 * @NApiVersion 2.0
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define([
    'N/record'
], function(record) {

    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */
    function execute(scriptContext) {

        // var CC_TaxFields_View = [
        //     "custrecord_lmry_ccl_fiscal_doctype", "custrecord_lmry_ccl_description", "custrecord_lmry_ar_ccl_subtype",
        //     "custrecord_lmry_sub_type", "custrecord_lmry_ccl_appliesto", "custrecord_lmry_ccl_applies_to_item",
        //     "custrecord_lmry_ccl_applies_to_account", "	custrecord_lmry_ar_ccl_taxrate_pctge", "custrecord_lmry_amount",
        //     "custrecord_lmry_ar_ccl_taxitem", "custrecord_lmry_ar_ccl_taxcode", "custrecord_lmry_ar_ccl_fechdesd",
        //     "custrecord_lmry_ar_ccl_fechhast", "custrecord_lmry_ar_ccl_fechpubl", "custrecord_lmry_br_ccl_account1",
        //     "custrecord_lmry_br_ccl_account2"
        // ];
        //
        // var CC_TaxFields_Mandatory = [
        //     "custrecord_lmry_ar_ccl_subtype", "custrecord_lmry_sub_type", "custrecord_lmry_ar_ccl_taxrate_pctge",
        //     "custrecord_lmry_ar_ccl_fechdesd", "custrecord_lmry_ar_ccl_fechhast", "custrecord_lmry_ar_ccl_fechpubl",
        //     "custrecord_lmry_br_ccl_account1", "custrecord_lmry_br_ccl_account2"
        // ];
        //
        // try {
        //
        //     for (var i = 0; i < CC_TaxFields_View.length; i++) {
        //
        //         var RecordObj = record.create({
        //             type: "customrecord_lmry_setup_tax_fields_view",
        //             isDynamic: false
        //         });
        //
        //         RecordObj.setValue({ fieldId: "name", value: CC_TaxFields_View[i], ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_country", value: 48, ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_record", value: 1, ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_genertrans", value: 1, ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_taxtype", value: 1, ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_applies_to_suitetax_acc", value: true, ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_wht_type", value: "", ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_wht_subtyp", value: "", ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_appliesto", value: "", ignoreFieldChange: true });
        //
        //         var RecordID = RecordObj.save({
        //             enableSourcing: true,
        //             ignoreMandatoryFields: true
        //         });
        //
        //         log.error('[ ' + i + ' ]', RecordID);
        //
        //     }
        //
        //     ///////////////////////
        //
        //     for (var j = 0; j < CC_TaxFields_Mandatory.length; j++) {
        //
        //         var RecordObj = record.create({
        //             type: "customrecord_lmry_setuptax_field_mandat",
        //             isDynamic: false
        //         });
        //
        //         RecordObj.setValue({ fieldId: "name", value: CC_TaxFields_Mandatory[j], ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_taxmand_country", value: 48, ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_taxmand_record_tax", value: 1, ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_taxmand_gen_transact", value: 1, ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_taxmand_tax_type", value: 1, ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_taxmand_wht_type", value: "", ignoreFieldChange: true });
        //         RecordObj.setValue({ fieldId: "custrecord_lmry_taxmand_wht_subtype", value: "", ignoreFieldChange: true });
        //
        //         var RecordID = RecordObj.save({
        //             enableSourcing: true,
        //             ignoreMandatoryFields: true
        //         });
        //
        //         log.error('[ ' + j + ' ]', RecordID);
        //
        //     }
        //
        // } catch (e) {
        //     log.error('[ execute ]', e);
        // }

        /******************************************************************************************/

        var NT_TaxFields_View = [
            "custrecord_lmry_ntax_fiscal_doctype", "custrecord_lmry_ntax_description", "custrecord_lmry_ntax_subtype",
            "custrecord_lmry_ntax_sub_type", "custrecord_lmry_ntax_appliesto", "custrecord_lmry_ntax_applies_to_item",
            "custrecord_lmry_ntax_applies_to_account", "custrecord_lmry_co_ntax_taxrate", "custrecord_lmry_ntax_amount",
            "custrecord_lmry_ntax_taxitem", "custrecord_lmry_ntax_taxcode", "custrecord_lmry_ntax_datefrom",
            "custrecord_lmry_ntax_dateto", "custrecord_lmry_ntax_publdate", "custrecord_lmry_ntax_debit_account",
            "custrecord_lmry_ntax_credit_account"
        ];

        // var NT_TaxFields_Mandatory = [
        //     "custrecord_lmry_ar_ccl_subtype", "custrecord_lmry_sub_type", "custrecord_lmry_ar_ccl_taxrate_pctge",
        //     "custrecord_lmry_ar_ccl_fechdesd", "custrecord_lmry_ar_ccl_fechhast", "custrecord_lmry_ar_ccl_fechpubl",
        //     "custrecord_lmry_br_ccl_account1", "custrecord_lmry_br_ccl_account2"
        // ];

        try {

            for (var i = 0; i < NT_TaxFields_View.length; i++) {

                var RecordObj = record.create({
                    type: "customrecord_lmry_setup_tax_fields_view",
                    isDynamic: false
                });

                RecordObj.setValue({ fieldId: "name", value: NT_TaxFields_View[i], ignoreFieldChange: true });
                RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_country", value: 48, ignoreFieldChange: true });
                RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_record", value: 2, ignoreFieldChange: true });
                RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_genertrans", value: 1, ignoreFieldChange: true });
                RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_taxtype", value: 1, ignoreFieldChange: true });
                RecordObj.setValue({ fieldId: "custrecord_lmry_applies_to_suitetax_acc", value: true, ignoreFieldChange: true });
                RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_wht_type", value: "", ignoreFieldChange: true });
                RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_wht_subtyp", value: "", ignoreFieldChange: true });
                RecordObj.setValue({ fieldId: "custrecord_lmry_setuptaxfield_appliesto", value: "", ignoreFieldChange: true });

                var RecordID = RecordObj.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                log.error('[ ' + i + ' ]', RecordID);

            }

            ///////////////////////

            // for (var j = 0; j < CC_TaxFields_Mandatory.length; j++) {
            //
            //     var RecordObj = record.create({
            //         type: "customrecord_lmry_setuptax_field_mandat",
            //         isDynamic: false
            //     });
            //
            //     RecordObj.setValue({ fieldId: "name", value: CC_TaxFields_Mandatory[j], ignoreFieldChange: true });
            //     RecordObj.setValue({ fieldId: "custrecord_lmry_taxmand_country", value: 48, ignoreFieldChange: true });
            //     RecordObj.setValue({ fieldId: "custrecord_lmry_taxmand_record_tax", value: 1, ignoreFieldChange: true });
            //     RecordObj.setValue({ fieldId: "custrecord_lmry_taxmand_gen_transact", value: 1, ignoreFieldChange: true });
            //     RecordObj.setValue({ fieldId: "custrecord_lmry_taxmand_tax_type", value: 1, ignoreFieldChange: true });
            //     RecordObj.setValue({ fieldId: "custrecord_lmry_taxmand_wht_type", value: "", ignoreFieldChange: true });
            //     RecordObj.setValue({ fieldId: "custrecord_lmry_taxmand_wht_subtype", value: "", ignoreFieldChange: true });
            //
            //     var RecordID = RecordObj.save({
            //         enableSourcing: true,
            //         ignoreMandatoryFields: true
            //     });
            //
            //     log.error('[ ' + j + ' ]', RecordID);
            //
            // }

        } catch (e) {
            log.error('[ execute ]', e);
        }

    }

    return {
        execute: execute
    };

});
