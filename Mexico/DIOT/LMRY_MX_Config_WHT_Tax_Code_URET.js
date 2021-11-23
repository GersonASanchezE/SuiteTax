/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 *@NModuleScope Public
 */
/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_MX_Config_WHT_Tax_Code_URET.js				||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     02 sep 2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
define(['N/log', 'N/search', 'N/ui/serverWidget', 'N/url', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],
    function (log, search, serverWidget, url, libraryMail) {

        var LMRY_script = "LatamReady - MX Config WHT Tax Code URET";

        function beforeLoad(context) {
            try {
                var recordObj = context.newRecord;
                var form = context.form;
                var type = context.type;
                createFields(recordObj, form, type);

            }
            catch (err) {
                libraryMail.sendemail("[ beforeLoad ]" + err, LMRY_script);
            }
        }


        function createFields(recordObj, form, type) {
            var nexusId = recordObj.getValue("custrecord_lmry_mx_conf_taxcode_nexus_id");
            var whtTaxTypeId = recordObj.getValue("custrecord_lmry_mx_conf_wht_tax_type");
            var taxCodeId = recordObj.getValue("custrecord_lmry_mx_conf_taxcode_id");

            var types = ["create", "edit", "copy"];
            if (types.indexOf(type) != -1) {

                var fieldNexus = form.addField({
                    id: 'custpage_nexus',
                    label: "Latam - Nexus",
                    type: serverWidget.FieldType.SELECT
                });
                fieldNexus.isMandatory = true;
                fieldNexus.setHelpText({ help: "Select the Nexus of the WHT Tax Code." });

                var fieldWhtTaxType = form.addField({
                    id: 'custpage_wht_tax_type',
                    label: "Latam - WHT Tax Type",
                    type: serverWidget.FieldType.SELECT
                });
                fieldWhtTaxType.isMandatory = true;
                fieldWhtTaxType.setHelpText({ help: "Select the WHT Tax Type of the WHT Tax Code." })

                var fieldTaxCode = form.addField({
                    id: 'custpage_wht_tax_code',
                    label: "Latam - WHT Tax Code",
                    type: serverWidget.FieldType.SELECT
                });
                fieldTaxCode.setHelpText({ help: "Select a Withholding Tax Code." })
                fieldTaxCode.isMandatory = true;

                addNexus(fieldNexus);
                if (type == "edit" || type == "copy") {
                    addWhtTaxTypes(recordObj, fieldWhtTaxType);
                    addTaxCodes(recordObj, fieldTaxCode);
                }

            } else {
                var fieldNexus = form.addField({
                    id: 'custpage_nexus',
                    label: "Latam - Nexus",
                    type: serverWidget.FieldType.TEXT
                });
                fieldNexus.setHelpText({ help: "Select the Nexus of the WHT Tax Code." });

                var fieldWhtTaxType = form.addField({
                    id: 'custpage_wht_tax_type',
                    label: "Latam - WHT Tax Type",
                    type: serverWidget.FieldType.TEXT
                });
                fieldWhtTaxType.setHelpText({ help: "Select the WHT Tax Type of the WHT Tax Code." })

                var fieldTaxCode = form.addField({
                    id: 'custpage_wht_tax_code',
                    label: "Latam - WHT Tax Code",
                    type: serverWidget.FieldType.TEXT
                });
                fieldTaxCode.setHelpText({ help: "Select a Withholding Tax Code." });

                if (nexusId) {
                    var nexusName = search.lookupFields({
                        type: "nexus",
                        id: nexusId,
                        columns: ["description"]
                    }).description;

                    fieldNexus.defaultValue = getLink("nexus", nexusId, nexusName);
                }

                if (whtTaxTypeId) {
                    var whtTaxTypeName = search.lookupFields({
                        type: "customrecord_4601_witaxtype",
                        id: whtTaxTypeId,
                        columns: ["custrecord_4601_wtt_name"]
                    }).custrecord_4601_wtt_name;

                    fieldWhtTaxType.defaultValue = getLink("customrecord_4601_witaxtype", whtTaxTypeId, whtTaxTypeName);
                }

                if (taxCodeId) {
                    var taxCodeName = search.lookupFields({
                        type: "customrecord_4601_witaxcode",
                        id: taxCodeId,
                        columns: ["custrecord_4601_wtc_name"]
                    }).custrecord_4601_wtc_name;

                    fieldTaxCode.defaultValue = getLink("customrecord_4601_witaxcode", taxCodeId, taxCodeName);
                }
            }

        }

        function getLink(recordType, recordId, text) {
            var recordUrl = url.resolveRecord({
                recordType: recordType,
                recordId: recordId
            });
            var link = '<span class="inputreadonly"><a class="dottedlink" href="' + recordUrl + '">' + text + '</a></span>'
            return link;
        }

        function addNexus(fieldSelect) {
            var searchNexus = search.create({
                type: "nexus",
                filters: [["isinactive", "is", "F"]],
                columns: ["internalid", search.createColumn({
                    name: "description",
                    sort: search.Sort.ASC
                })]
            });

            var results = searchNexus.run().getRange(0, 1000);
            fieldSelect.addSelectOption({ value: 0, text: "&nbsp;" });
            if (results && results.length) {
                for (var i = 0; i < results.length; i++) {
                    var id = results[i].getValue("internalid");
                    var name = results[i].getValue("description");
                    fieldSelect.addSelectOption({ value: id, text: name });
                }
            }
        }

        function addWhtTaxTypes(recordObj, fieldSelect) {
            var nexusId = recordObj.getValue("custrecord_lmry_mx_conf_taxcode_nexus_id");
            if (nexusId) {
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
                fieldSelect.addSelectOption({ value: 0, text: "&nbsp;" });
                if (results && results.length) {
                    for (var i = 0; i < results.length; i++) {
                        var id = results[i].getValue("internalid");
                        var name = results[i].getValue("custrecord_4601_wtt_name");
                        fieldSelect.addSelectOption({ value: id, text: name });
                    }
                }
            }
        }

        function addTaxCodes(recordObj, fieldSelect) {
            var whtTaxTypeId = recordObj.getValue("custrecord_lmry_mx_conf_wht_tax_type");
            if (whtTaxTypeId) {
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
                fieldSelect.addSelectOption({ value: 0, text: "&nbsp;" });

                if (results && results.length) {
                    for (var i = 0; i < results.length; i++) {
                        var id = results[i].getValue("internalid");
                        var name = results[i].getValue("custrecord_4601_wtc_name");

                        fieldSelect.addSelectOption({ value: id, text: name });
                    }
                }
            }
        }

        return {
            beforeLoad: beforeLoad
        }
    });
