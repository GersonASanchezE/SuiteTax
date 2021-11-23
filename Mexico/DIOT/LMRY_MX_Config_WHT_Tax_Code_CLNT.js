/**
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 *@NModuleScope Public
 */
/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_MX_Config_WHT_Tax_Code_CLNT.js				||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     02 sep 2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
define(["N/search", "N/runtime", "./Latam_Library/LMRY_libSendingEmailsLBRY_V2.0"],
    function (search, runtime, libraryMail) {

        var LMRY_script = "LatamReady - MX Config WHT Tax Code CLNT";
        var type = "";
        var language = "";
        function pageInit(context) {
            try {
                var currentRecord = context.currentRecord;
                type = context.mode;

                language = runtime.getCurrentScript().getParameter({
                    name: "LANGUAGE"
                });
                language = language.substring(0, 2).toLowerCase();

                if (type != "create") {
                    var nexusId = currentRecord.getValue("custrecord_lmry_mx_conf_taxcode_nexus_id") || 0;
                    var whtTaxTypeId = currentRecord.getValue("custrecord_lmry_mx_conf_wht_tax_type") || 0;
                    var taxCodeId = currentRecord.getValue("custrecord_lmry_mx_conf_taxcode_id") || 0;

                    currentRecord.setValue({ fieldId: "custpage_nexus", value: nexusId, ignoreFieldChange: true });
                    currentRecord.setValue({ fieldId: "custpage_wht_tax_type", value: whtTaxTypeId, ignoreFieldChange: true });
                    currentRecord.setValue({ fieldId: "custpage_wht_tax_code", value: taxCodeId, ignoreFieldChange: true });
                }
            } catch (err) {
                alert("[ pageInit ]\n" + err.message);
                console.log(err);
                libraryMail.sendemail("[ pageInit ]" + err, LMRY_script);
            }
        }

        function validateField(context) {
            try {
                var currentRecord = context.currentRecord;
                var fieldId = context.fieldId;
                if (fieldId == "custpage_nexus") {
                    addWhtTaxTypes(currentRecord);
                    addTaxCodes(currentRecord);

                } else if (fieldId == "custpage_wht_tax_type") {
                    addTaxCodes(currentRecord);
                }

            } catch (err) {
                alert("[ validateField ]\n" + err.message);
                console.log(err);
                libraryMail.sendemail("[ validateField ]" + err, LMRY_script);
                return false;
            }
            return true;
        }

        function saveRecord(context) {
            try {
                var currentRecord = context.currentRecord;
                if (!validateMandatoryFields(currentRecord)) {
                    return false;
                }

                if (!validateDuplicated(currentRecord)) {
                    return false;
                }

                setValues(currentRecord);
            } catch (err) {
                alert("[ saveRecord ]\n" + err.message);
                console.log(err);
                libraryMail.sendemail("[ saveRecord ]" + err, LMRY_script);
                return false;
            }
            return true;
        }

        function addWhtTaxTypes(currentRecord) {
            var nexusId = currentRecord.getValue("custpage_nexus");
            var fieldSelect = currentRecord.getField("custpage_wht_tax_type");
            fieldSelect.removeSelectOption({ value: null });
            fieldSelect.insertSelectOption({ value: 0, text: "&nbsp;" });
            if (Number(nexusId)) {
                var searchWhtTaxTypes = search.create({
                    type: "customrecord_4601_witaxtype",
                    filters: [
                        ["isinactive", "is", "F"], "AND",
                        ["custrecord_4601_wtt_witaxsetup.custrecord_4601_wts_nexus", "equalto", nexusId],
                    ],
                    columns: ["internalid", search.createColumn({
                        name: "custrecord_4601_wtt_name",
                        sort: search.Sort.ASC
                    })]
                });

                var results = searchWhtTaxTypes.run().getRange(0, 1000);
                if (results && results.length) {
                    for (var i = 0; i < results.length; i++) {
                        var id = results[i].getValue("internalid");
                        var name = results[i].getValue("custrecord_4601_wtt_name");
                        fieldSelect.insertSelectOption({ value: id, text: name });
                    }
                }
            }
        }

        function addTaxCodes(currentRecord) {
            var whtTaxTypeId = currentRecord.getValue("custpage_wht_tax_type");
            var fieldSelect = currentRecord.getField("custpage_wht_tax_code");
            fieldSelect.removeSelectOption({ value: null });
            fieldSelect.insertSelectOption({ value: 0, text: "&nbsp;" });

            if (Number(whtTaxTypeId)) {
                var searchTaxCodes = search.create({
                    type: "customrecord_4601_witaxcode",
                    filters: [
                        ["isinactive", "is", "F"], "AND",
                        ["custrecord_4601_wtc_istaxgroup", "is", "F"], "AND",
                        ["custrecord_4601_wtc_witaxtype", "anyof", whtTaxTypeId]
                    ],
                    columns: ["internalid", search.createColumn({
                        name: "custrecord_4601_wtc_name",
                        sort: search.Sort.ASC
                    })]
                });

                var results = searchTaxCodes.run().getRange(0, 1000);
                if (results && results.length) {
                    for (var i = 0; i < results.length; i++) {
                        var id = results[i].getValue("internalid");
                        var name = results[i].getValue("custrecord_4601_wtc_name");
                        fieldSelect.insertSelectOption({ value: id, text: name });
                    }
                }
            }
        }

        function validateMandatoryFields(currentRecord) {
            var validate = true;

            var mandatoryFields = ["custpage_nexus", "custpage_wht_tax_type", "custpage_wht_tax_code"];
            var mandatoryMsg = "";
            var MESSAGE = { 'es': 'Requiere campos: \n', 'en': 'Require Fields: \n' };
            mandatoryMsg += MESSAGE[language] || MESSAGE['en'];

            for (var i = 0; i < mandatoryFields.length; i++) {
                var field = currentRecord.getField({ fieldId: mandatoryFields[i] });
                if (field) {
                    var value = currentRecord.getValue(mandatoryFields[i]);
                    if (!Number(value)) {
                        mandatoryMsg += " " + field.label + "\n";
                        validate = false;
                    }
                }
            }

            if (!validate) {
                alert(mandatoryMsg);
            }
            return validate;
        }

        function setValues(currentRecord) {
            var nexusId = currentRecord.getValue("custpage_nexus");
            nexusId = Number(nexusId) || "";
            var whtTaxTypeId = currentRecord.getValue("custpage_wht_tax_type");
            whtTaxTypeId = Number(whtTaxTypeId) || "";
            var taxCodeId = currentRecord.getValue("custpage_wht_tax_code");
            taxCodeId = Number(taxCodeId) || "";
            currentRecord.setValue({ fieldId: "custrecord_lmry_mx_conf_taxcode_nexus_id", value: nexusId, ignoreFieldChange: true });
            currentRecord.setValue({ fieldId: "custrecord_lmry_mx_conf_wht_tax_type", value: whtTaxTypeId, ignoreFieldChange: true });
            currentRecord.setValue({ fieldId: "custrecord_lmry_mx_conf_taxcode_id", value: taxCodeId, ignoreFieldChange: true });
            var countryCode = "";
            if (nexusId) {
                var country = search.lookupFields({
                    type: "nexus",
                    id: nexusId,
                    columns: ["country"]
                }).country;

                countryCode = country[0]["value"];
            }
            currentRecord.setValue({ fieldId: "custrecord_lmry_mx_conf_taxcode_country", value: countryCode, ignoreFieldChange: true });
        }


        function validateDuplicated(currentRecord) {
            var validate = true;
            var taxCodeId = currentRecord.getValue("custpage_wht_tax_code");
            var whtTaxTypeText = currentRecord.getText("custpage_wht_tax_type")
            var taxCodeText = currentRecord.getText("custpage_wht_tax_code");
            if (Number(taxCodeId)) {

                var filters = [
                    ["isinactive", "is", "F"], "AND",
                    ["custrecord_lmry_mx_conf_taxcode_id", "equalto", taxCodeId]
                ];

                if (currentRecord.id) {
                    filters.push("AND", ["internalid", "noneof", currentRecord.id])
                }

                var searchTaxCodes = search.create({
                    type: "customrecord_lmry_mx_config_wht_tax_code",
                    filters: filters,
                    columns: ["internalid"]
                });

                var results = searchTaxCodes.run().getRange(0, 10);

                if (results && results.length) {
                    validate = false;
                }
            }

            if (!validate) {
                var MESSAGE = {
                    'en': 'The WHT Tax Code #TAXCODE is already registered.',
                    'es': 'El WHT Tax Code #TAXCODE ya esta registrado.'
                };

                var msg = MESSAGE[language] || MESSAGE['en'];
                msg = msg.replace("#TAXCODE", whtTaxTypeText + ":" + taxCodeText);
                alert(msg);
            }

            return validate;
        }



        return {
            pageInit: pageInit,
            saveRecord: saveRecord,
            validateField: validateField,
        }
    });
