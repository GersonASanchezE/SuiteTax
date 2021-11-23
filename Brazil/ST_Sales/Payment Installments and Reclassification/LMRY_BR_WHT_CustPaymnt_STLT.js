/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BR_WHT_CustPaymnt_STLT.js        	          ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     8 Apr  2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope Public
 */
define(['N/log', 'N/ui/serverWidget', 'N/search', 'N/runtime', 'N/error', 'N/redirect', 'N/task', 'N/url', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],
    function (log, serverWidget, search, runtime, error, redirect, task, url, library_mail) {
        var ID_COUNTRY = 30; //Brazil
        var TYPE_TRANSACTION = 7; //Invoice
        var ID_FEATURE = 141; // Feature BR - WHT Payment

        var SCRIPT_ID = 'customscript_lmry_br_custpayments_stlt';
        var DEPLOY_ID = 'customdeploy_lmry_br_custpayments_stlt';
        var SCRIPT_ID_LOG = 'customscript_lmry_br_custpaymt_log_stlt';
        var DEPLOY_ID_LOG = 'customdeploy_lmry_br_custpaymt_log_stlt';
        var MR_SCRIPT_ID = 'customscript_lmry_br_custpayments_mprd';
        var MR_DEPLOYMENT_ID = 'customdeploy_lmry_br_custpayments_mprd';
        var CLIENT_SCRIPT = './Latam_Library/LMRY_BR_WHT_CustPaymnt_CLNT.js';
        var LANGUAGE = '';
        var FEAT_SUBS = true;
        var FEAT_JOBS = false;
        var FEAT_DPT = false;
        var FEAT_LOC = false;
        var FEAT_CLASS = false;
        var DEPTMANDATORY = false;
        var LOCMANDATORY = false;
        var CLASSMANDATORY = false;
        var FEAT_INSTALLMENTS = false;
        var LMRY_script = 'LatamReady - BR WHT Customer Payment STLT';
        var LIC_BY_SUBSIDIARY = {};

        function onRequest(context) {
            LANGUAGE = runtime.getCurrentScript().getParameter({ name: "LANGUAGE" });
            LANGUAGE = LANGUAGE.substring(0, 2);
            FEAT_SUBS = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });
            FEAT_JOBS = runtime.isFeatureInEffect({ feature: "JOBS" });
            FEAT_DPT = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
            FEAT_LOC = runtime.isFeatureInEffect({ feature: "LOCATIONS" });
            FEAT_CLASS = runtime.isFeatureInEffect({ feature: "CLASSES" });

            DEPTMANDATORY = runtime.getCurrentUser().getPreference({ name: "DEPTMANDATORY" });
            LOCMANDATORY = runtime.getCurrentUser().getPreference({ name: "LOCMANDATORY" });
            CLASSMANDATORY = runtime.getCurrentUser().getPreference({ name: "CLASSMANDATORY" });

            FEAT_INSTALLMENTS = runtime.isFeatureInEffect({ feature: "installments" });

            if (context.request.method == 'GET') {
                try {
                    LIC_BY_SUBSIDIARY = library_mail.getAllLicenses();
                    log.error('licenses', JSON.stringify(LIC_BY_SUBSIDIARY));
                    var form = createForm();
                    var customSegments = createCustomSegmentFields(form);
                    log.error("customSegments", customSegments);
                    var localCurrency = getLocalCurrency();
                    var sublist = createApplySublist(form);
                    setValues(context, form, localCurrency, customSegments);

                    var status = context.request.parameters.status;
                    if (!status) {
                        form.getField({ id: 'custpage_memo' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                        form.getField({ id: 'custpage_status' }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });
                        form.addSubmitButton({
                            label: getText('filter')
                        });

                    } else if (status == '1') {
                        disableFields(form, customSegments);
                        var transactions = getTransactions(context);
                        log.error('transactions', JSON.stringify(transactions));
                        loadTransactions(transactions, sublist);

                        form.addSubmitButton({
                            label: getText('save')
                        });

                        form.addButton({
                            id: 'button_cancel',
                            label: getText('cancel'),
                            functionName: 'cancel'
                        });
                    }

                    form.clientScriptModulePath = CLIENT_SCRIPT;
                    context.response.writePage(form);

                } catch (err) {
                    library_mail.sendemail('[ onRequest - GET ]' + err, LMRY_script);
                }
            } else {
                try {

                    var fieldNames = ['status', 'subsidiary', 'customer', 'araccount', 'date', 'period', 'document', 'undepfunds', 'bankaccount', 'department', 'class', 'location', 'paymentmethod', 'memo', 'currency'];

                    var customSegments = getCustomSegments();
                    fieldNames = fieldNames.concat(customSegments);

                    var params = {}
                    for (var i = 0; i < fieldNames.length; i++) {
                        params[fieldNames[i]] = context.request.parameters['custpage_' + fieldNames[i]];
                    }

                    if (!params['status']) {
                        params['status'] = '1';
                        redirect.toSuitelet({
                            scriptId: SCRIPT_ID,
                            deploymentId: DEPLOY_ID,
                            parameters: params
                        });

                    } else if (params['status'] == '1') {

                        var idlog = context.request.parameters.custpage_idlog;
                        log.error('idlog', idlog);
                        if (idlog) {

                            var task_mr = task.create({
                                taskType: task.TaskType.MAP_REDUCE,
                                scriptId: MR_SCRIPT_ID,
                                deploymentId: MR_DEPLOYMENT_ID,
                                params: {
                                    'custscript_lmry_br_custpayment_log': idlog
                                }
                            });

                            task_mr.submit();
                        }

                        redirect.toSuitelet({
                            scriptId: SCRIPT_ID_LOG,
                            deploymentId: DEPLOY_ID_LOG
                        });
                    }


                } catch (err) {
                    library_mail.sendemail('[ onRequest - POST ]' + err, LMRY_script);
                }
            }
        }


        function createForm() {
            var form = serverWidget.createForm({
                title: getText('title')
            });

            form.addFieldGroup({
                id: 'main_group',
                label: getText('primaryinformation')
            });

            if (FEAT_SUBS == true || FEAT_SUBS == 'T') {
                var objFieldSubsidiary = {
                    id: 'custpage_subsidiary',
                    type: serverWidget.FieldType.SELECT,
                    label: getText('subsidiary'),
                    container: 'main_group'
                }

                var field_subsidiary = form.addField(objFieldSubsidiary);

                field_subsidiary.isMandatory = true;
            }

            form.addField({
                id: 'custpage_customer',
                type: serverWidget.FieldType.SELECT,
                label: getText('customer'),
                container: 'main_group'
            }).isMandatory = true;


            form.addField({
                id: 'custpage_currency',
                type: serverWidget.FieldType.SELECT,
                label: getText('currency'),
                container: 'main_group',
                source: 'currency'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
            });

            form.addField({
                id: 'custpage_exchangerate',
                type: serverWidget.FieldType.FLOAT,
                label: getText('exchangerate'),
                container: 'main_group'
            }).updateDisplayType({
                displayType: serverWidget.FieldDisplayType.DISABLED
            });


            form.addField({
                id: 'custpage_araccount',
                type: serverWidget.FieldType.SELECT,
                label: getText('araccount'),
                container: 'main_group'
            }).isMandatory = true;

            var accountGroup = form.addFieldGroup({
                id: 'account_group',
                label: 'Account',
                container: 'main_group'
            });
            accountGroup.isBorderHidden = true;
            accountGroup.isSingleColumn = true;
            form.addField({
                id: 'custpage_undepfunds',
                type: serverWidget.FieldType.RADIO,
                label: getText('undepfunds'),
                container: 'account_group',
                source: 'T'
            });

            form.addField({
                id: 'custpage_undepfunds',
                type: serverWidget.FieldType.RADIO,
                label: getText('bankaccount'),
                container: 'account_group',
                source: 'F'
            });

            form.addField({
                id: 'custpage_bankaccount',
                type: serverWidget.FieldType.SELECT,
                label: "&nbsp;",
                container: 'account_group',
            });

            form.addField({
                id: 'custpage_date',
                type: serverWidget.FieldType.DATE,
                label: getText('date'),
                container: 'main_group'
            }).isMandatory = true;

            form.addField({
                id: 'custpage_period',
                type: serverWidget.FieldType.SELECT,
                label: getText('period'),
                container: 'main_group'
            }).isMandatory = true;

            form.addField({
                id: 'custpage_document',
                type: serverWidget.FieldType.SELECT,
                label: getText('document'),
                container: 'main_group'
            }).isMandatory = true;

            form.addField({
                id: 'custpage_memo',
                type: serverWidget.FieldType.TEXT,
                label: getText('memo'),
                container: 'main_group'
            });

            form.addFieldGroup({
                id: 'clasiffication_group',
                label: getText('classification')
            });

            if (FEAT_DPT == true || FEAT_DPT == 'T') {
                var field_department = form.addField({
                    id: 'custpage_department',
                    type: serverWidget.FieldType.SELECT,
                    label: getText('department'),
                    container: 'clasiffication_group'
                });

                field_department.isMandatory = (DEPTMANDATORY == true || DEPTMANDATORY == 'T');
            }

            if (FEAT_CLASS == true || FEAT_CLASS == 'T') {
                var field_class = form.addField({
                    id: 'custpage_class',
                    type: serverWidget.FieldType.SELECT,
                    label: getText('class'),
                    container: 'clasiffication_group'
                });

                field_class.isMandatory = (CLASSMANDATORY == true || CLASSMANDATORY == 'T');
            }


            if (FEAT_LOC == true || FEAT_LOC == 'T') {
                var field_location = form.addField({
                    id: 'custpage_location',
                    type: serverWidget.FieldType.SELECT,
                    label: getText('location'),
                    container: 'clasiffication_group'
                });

                field_location.isMandatory = (LOCMANDATORY == true || LOCMANDATORY == 'T');
            }

            form.addField({
                id: 'custpage_paymentmethod',
                type: serverWidget.FieldType.SELECT,
                label: getText('paymentmethod'),
                container: 'clasiffication_group'
            });

            form.addField({
                id: 'custpage_status',
                type: serverWidget.FieldType.TEXT,
                label: 'Status',
                container: 'main_group'
            }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

            form.addField({
                id: 'custpage_idlog',
                type: serverWidget.FieldType.TEXT,
                label: 'ID Log'
            }).updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

            return form;
        }

        function createApplySublist(form) {
            form.addTab({
                id: 'apply_tab',
                label: getText('apply')
            });

            var sublist = form.addSublist({
                id: 'custpage_list_apply',
                label: getText('invoices'),
                tab: 'apply_tab',
                type: serverWidget.SublistType.LIST
            });

            sublist.addField({
                id: 'apply',
                label: getText('apply'),
                type: serverWidget.FieldType.CHECKBOX
            });

            sublist.addField({
                id: 'date',
                label: getText('date'),
                type: serverWidget.FieldType.TEXT
            });

            sublist.addField({
                id: 'type',
                label: getText('type'),
                type: serverWidget.FieldType.TEXT
            });

            sublist.addField({
                id: 'internalid',
                label: getText('internalid'),
                type: serverWidget.FieldType.TEXT
            });

            sublist.addField({
                id: 'tranid',
                label: getText('tranid'),
                type: serverWidget.FieldType.TEXT
            });


            sublist.addField({
                id: "installnum",
                label: getText("installnum"),
                type: serverWidget.FieldType.TEXT
            });

            sublist.addField({
                id: 'customer',
                label: getText('customer'),
                type: serverWidget.FieldType.TEXT
            });

            sublist.addField({
                id: 'memo',
                label: getText('memo'),
                type: serverWidget.FieldType.TEXTAREA
            })

            sublist.addField({
                id: 'document',
                label: getText('document_line'),
                type: serverWidget.FieldType.TEXT
            });

            sublist.addField({
                id: 'currency',
                label: getText('currency'),
                type: serverWidget.FieldType.TEXT
            });

            sublist.addField({
                id: 'totalamount',
                label: getText('totalamount'),
                type: serverWidget.FieldType.CURRENCY
            });

            var field_amountdue = sublist.addField({
                id: 'amountdue',
                label: getText('amountdue'),
                type: serverWidget.FieldType.CURRENCY
            });

            field_amountdue.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });
            field_amountdue.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });


            var field_payment = sublist.addField({
                id: 'payment',
                label: getText('payment'),
                type: serverWidget.FieldType.CURRENCY
            });
            field_payment.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

            var field_interest = sublist.addField({
                id: 'interest',
                label: getText('interest'),
                type: serverWidget.FieldType.CURRENCY
            });
            field_interest.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

            var field_penalty = sublist.addField({
                id: 'penalty',
                label: getText('penalty'),
                type: serverWidget.FieldType.CURRENCY
            });
            field_penalty.updateDisplayType({ displayType: serverWidget.FieldDisplayType.ENTRY });

            sublist.addButton({
                id: 'button_paidall',
                label: getText('paidall'),
                functionName: 'toggleCheckBoxes(true)'
            });

            sublist.addButton({
                id: 'button_clear',
                label: getText('clear'),
                functionName: 'toggleCheckBoxes(false)'
            });

            return sublist;
        }

        function setValues(context, form, localCurrency, customSegments) {
            var status = context.request.parameters.status;
            var subsidiary = context.request.parameters.subsidiary;
            subsidiary = Number(subsidiary);
            var customer = context.request.parameters.customer;
            customer = Number(customer);
            var araccount = context.request.parameters.araccount;
            araccount = Number(araccount);
            var date = context.request.parameters.date;
            var period = context.request.parameters.period;
            period = Number(period);
            var document = context.request.parameters.document;
            document = Number(document);
            var undepfunds = context.request.parameters.undepfunds;
            var bankaccount = context.request.parameters.bankaccount;
            bankaccount = Number(bankaccount);
            var department = context.request.parameters.department;
            department = Number(department);
            var class_ = context.request.parameters.class;
            class_ = Number(class_);
            var location = context.request.parameters.location;
            location = Number(location);
            var paymentMethod = context.request.parameters.paymentmethod;
            paymentMethod = Number(paymentMethod);

            log.error('params', JSON.stringify(context.request.parameters));

            addSubsidiaries(form, localCurrency, subsidiary);
            addDocuments(form, document);
            addPaymentMethods(form, paymentMethod);

            if (status == '1') {
                addCustomer(form, customer);
                if (araccount) {
                    var name = search.lookupFields({
                        type: 'account', id: araccount,
                        columns: 'name'
                    }).name;

                    if (name) {
                        var field_araccount = form.getField({ id: 'custpage_araccount' })
                        field_araccount.addSelectOption({ value: araccount, text: name });
                        field_araccount.defaultValue = araccount;
                    }
                }

                if (period) {

                    var name = search.lookupFields({
                        type: 'accountingperiod',
                        id: period,
                        columns: 'periodname'
                    }).periodname;

                    if (name) {
                        var field_period = form.getField({ id: 'custpage_period' });
                        field_period.addSelectOption({ value: period, text: name });
                        field_period.defaultValue = period;
                    }
                }


                if (undepfunds == 'F' && bankaccount) {
                    var name = search.lookupFields({
                        type: 'account',
                        id: bankaccount,
                        columns: 'name'
                    }).name;

                    if (name) {
                        var field_bankaccount = form.getField({ id: 'custpage_bankaccount' });
                        field_bankaccount.addSelectOption({ value: bankaccount, text: name });
                        field_bankaccount.defaultValue = bankaccount;
                    }
                }

                if (FEAT_DPT && department) {
                    var name = search.lookupFields({
                        type: 'department',
                        id: department,
                        columns: 'name'
                    }).name;

                    if (name) {
                        var field_department = form.getField({ id: 'custpage_department' });
                        field_department.addSelectOption({ value: department, text: name });
                        field_department.defaultValue = department;
                    }
                }

                if (FEAT_CLASS && class_) {
                    var name = search.lookupFields({
                        type: 'classification',
                        id: class_,
                        columns: 'name'
                    }).name;

                    if (name) {
                        var field_class = form.getField({ id: 'custpage_class' });
                        field_class.addSelectOption({ value: class_, text: name });
                        field_class.defaultValue = class_
                    }
                }

                if (FEAT_LOC && location) {
                    var name = search.lookupFields({
                        type: 'location',
                        id: location,
                        columns: 'name'
                    }).name;

                    if (name) {
                        var field_location = form.getField({ id: 'custpage_location' });
                        field_location.addSelectOption({ value: location, text: name });
                        field_location.defaultValue = location;
                    }
                }

                customer && (form.getField({ id: 'custpage_customer' }).defaultValue = customer);
                date && (form.getField({ id: 'custpage_date' }).defaultValue = date);
                document && (form.getField({ id: 'custpage_document' }.defaultValue = document));
                undepfunds && (form.getField({ id: 'custpage_undepfunds' }).defaultValue = undepfunds);
                paymentMethod && (form.getField({ id: 'custpage_paymentmethod' }).defaultValue = paymentMethod);

                for (var i = 0; i < customSegments.length; i++) {
                    var segmentId = customSegments[i];
                    var segmentValue = context.request.parameters[segmentId] || "";
                    var segmentField = form.getField({ id: "custpage_" + segmentId });
                    if (Number(segmentValue) && segmentField) {
                        segmentField.defaultValue = segmentValue;
                    }
                }

                form.getField({ id: 'custpage_status' }).defaultValue = '1';
            }

            form.getField({ id: 'custpage_currency' }).defaultValue = localCurrency;
            form.getField({ id: 'custpage_exchangerate' }).defaultValue = 1.0;

        }


        function disableFields(form, customSegments) {
            var FIELDS = ['custpage_subsidiary', 'custpage_customer', 'custpage_araccount', 'custpage_date', 'custpage_period', 'custpage_document',
                'custpage_bankaccount', 'custpage_department', 'custpage_class', 'custpage_location', 'custpage_paymentmethod'];

            for (var i = 0; i < customSegments.length; i++) {
                FIELDS.push("custpage_" + customSegments[i]);
            }

            for (var i = 0; i < FIELDS.length; i++) {
                var field = form.getField({ id: FIELDS[i] });
                if (field) {
                    field.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                }
            }
        }

        function addCustomer(form, customer) {
            var field_customer = form.getField({ id: 'custpage_customer' });
            var result = search.lookupFields({
                type: 'customer',
                id: customer,
                columns: ['internalid', 'companyname', 'isperson', 'firstname', 'middlename', 'lastname', 'entityid']
            });

            if (result['internalid']) {
                var isperson = result['isperson'];
                var firstname = result['firstname'];
                var middlename = result['middlename'];
                var lastname = result['lastname'];
                var entityid = result['entityid'];
                var companyname = result['companyname'];

                var name = entityid + " " + ((companyname) ? companyname : "");

                if (isperson) {
                    name = entityid + " " + firstname + " " + ((middlename) ? (middlename + " ") : "") + lastname;
                }

                /*if (!name) {
                    name = result.getValue('entityid');
                }*/

                field_customer.addSelectOption({ value: customer, text: name });
            }
        }


        function addDocuments(form, document) {
            var field_document = form.getField({ id: 'custpage_document' });
            if (!document) {
                //field_document.addSelectOption({ value: 0, text: '&nbsp;' });
                var search_documents = search.create({
                    type: 'customrecord_lmry_tipo_doc',
                    filters: [
                        ['isinactive', 'is', 'F'], 'AND',
                        ['custrecord_lmry_country_applied', 'anyof', ID_COUNTRY], 'AND',
                        ['custrecord_lmry_tipo_transaccion', 'anyof', TYPE_TRANSACTION], 'AND',
                        ['custrecord_lmry_tipo_transaccion', 'anyof', '7'], 'AND',//Invoice
                        ['custrecord_lmry_document_apply_wht', 'is', 'T']
                    ],
                    columns: ['internalid', search.createColumn({
                        name: "name",
                        sort: search.Sort.ASC
                    })]
                });

                var results = search_documents.run().getRange(0, 1000);

                if (results) {
                    for (var i = 0; i < results.length; i++) {
                        var id = results[i].getValue('internalid');
                        var name = results[i].getValue('name');
                        field_document.addSelectOption({ value: id, text: name });
                    }
                }
            } else {
                var name = search.lookupFields({
                    type: 'customrecord_lmry_tipo_doc',
                    id: document,
                    columns: 'name'
                }).name;

                if (name) {
                    field_document.addSelectOption({ value: document, text: name });
                }
            }
        }


        function addPaymentMethods(form, paymentMethod) {
            var field_paymentmethod = form.getField({ id: 'custpage_paymentmethod' });
            if (!paymentMethod) {
                var search_methods = search.create({
                    type: 'customrecord_lmry_paymentmethod',
                    filters: [
                        ['isinactive', 'is', 'F'], 'AND', ['custrecord_lmry_country_pm', 'anyof', ID_COUNTRY]
                    ],
                    columns: ['internalid', 'name']
                });

                var results = search_methods.run().getRange(0, 1000);

                field_paymentmethod.addSelectOption({ value: 0, text: '&nbsp;' });

                if (results && results.length) {
                    for (var i = 0; i < results.length; i++) {
                        var id = results[i].getValue('internalid');
                        var name = results[i].getValue('name');
                        field_paymentmethod.addSelectOption({ value: id, text: name });
                    }
                }
            } else {
                var name = search.lookupFields({
                    type: 'customrecord_lmry_paymentmethod',
                    id: paymentMethod,
                    columns: ['internalid', 'name']
                }).name;

                field_paymentmethod.addSelectOption({ value: paymentMethod, text: name });
            }
        }

        function addSubsidiaries(form, localCurrency, subsidiary) {
            var field_subsidiary = form.getField('custpage_subsidiary');
            if (!subsidiary) {
                var search_subsidiaries = search.create({
                    type: 'subsidiary',
                    filters: [
                        ['isinactive', 'is', 'F'], 'AND',
                        ['country', 'anyof', 'BR'], 'AND',
                        ['currency', 'anyof', localCurrency]
                    ],
                    columns: ['internalid', 'name']
                });

                field_subsidiary.addSelectOption({ value: 0, text: '&nbsp;' });

                var results = search_subsidiaries.run().getRange(0, 1000);
                if (results && results.length) {
                    for (var i = 0; i < results.length; i++) {
                        var id = results[i].getValue('internalid');
                        var name = results[i].getValue('name');
                        if (LIC_BY_SUBSIDIARY[String(id)] && LIC_BY_SUBSIDIARY[String(id)].indexOf(ID_FEATURE) != -1) {
                            field_subsidiary.addSelectOption({ value: id, text: name });
                        }
                    }
                }
            } else {
                if (LIC_BY_SUBSIDIARY[String(subsidiary)] && LIC_BY_SUBSIDIARY[String(subsidiary)].indexOf(ID_FEATURE) != -1) {
                    var name = search.lookupFields({
                        type: 'subsidiary',
                        id: subsidiary,
                        columns: 'name'
                    }).name;

                    if (name) {
                        field_subsidiary.addSelectOption({ value: subsidiary, text: name });
                    }
                }
            }
        }

        function getLocalCurrency() {
            var search_currency = search.create({
                type: 'customrecord_lmry_currency_by_country',
                filters: [
                    ['isinactive', 'is', 'F'], 'AND',
                    ['custrecord_lmry_is_country_base_currency', 'is', 'T'], 'AND',
                    ['custrecord_lmry_currency_country_local', 'anyof', ID_COUNTRY]
                ],
                columns: ['internalid', 'custrecord_lmry_currency']
            });

            var results = search_currency.run().getRange(0, 1000);
            if (results && results.length) {
                return results[0].getValue('custrecord_lmry_currency');
            } else {
                var errorObj = error.create({
                    name: 'CURRENCY_ISNT_CONFIGURED',
                    message: "The record LatamReady - Currency by Country is not configured for this country.",
                    notifyOff: false
                });
                throw errorObj;
            }
        }

        function getTransactions(context) {
            var transactions = [];
            var subsidiary = context.request.parameters.subsidiary;
            subsidiary = Number(subsidiary);
            var customer = context.request.parameters.customer;
            customer = Number(customer);
            var currency = context.request.parameters.currency;
            currency = Number(currency);
            var araccount = context.request.parameters.araccount;
            araccount = Number(araccount);
            var date = context.request.parameters.date;
            var document = context.request.parameters.document;
            document = Number(document);

            var search_transactions = search.load({
                id: 'customsearch_lmry_br_wht_invoices_to_pay'
            });

            if (FEAT_INSTALLMENTS == "T" || FEAT_INSTALLMENTS == true) {
                search_transactions.columns.push(
                    search.createColumn({
                        name: "installmentnumber",
                        join: "installment",
                        sort: search.Sort.ASC
                    }),
                    search.createColumn({
                        name: "fxamountremaining",
                        join: "installment"
                    }),
                    search.createColumn({
                        name: "fxamount",
                        join: "installment"
                    }),
                    search.createColumn({
                        name: "fxamountpaid",
                        join: "installment"
                    }));
            }


            var filters = search_transactions.filters;

            if (subsidiary) {
                filters.push(search.createFilter({ name: 'subsidiary', operator: 'anyof', values: [subsidiary] }));
            }

            if (customer) {
                if (FEAT_JOBS == 'T' || FEAT_JOBS == true) {
                    filters.push(search.createFilter({ name: 'internalid', join: 'customermain', operator: 'anyof', values: [customer] }));
                } else {
                    filters.push(search.createFilter({ name: "internalid", join: "customer", operator: "anyof", "values": [customer] }));
                }
            }

            if (currency) {
                filters.push(search.createFilter({ name: 'currency', operator: 'anyof', values: [currency] }));
            }

            if (araccount) {
                filters.push(search.createFilter({ name: 'account', operator: 'anyof', values: [araccount] }));
            }

            if (date) {
                filters.push(search.createFilter({ name: 'trandate', operator: 'onorbefore', values: [date] }));
            }

            if (document) {
                filters.push(search.createFilter({ name: 'custbody_lmry_document_type', operator: 'anyof', values: [document] }));
            }

            var results = search_transactions.run().getRange(0, 1000);
            var columns = search_transactions.columns;
            if (results && results.length) {
                for (var i = 0; i < results.length; i++) {

                    var transaction = {
                        'internalid': results[i].getValue(columns[0]),
                        'currency': results[i].getText(columns[2]),
                        'tranid': results[i].getValue(columns[3]),
                        'date': results[i].getValue(columns[4]),
                        'memo': results[i].getValue(columns[5]) || '',
                        'customer': results[i].getText(columns[6]),
                        'document': results[i].getText(columns[7]),
                        'amountdue': parseFloat(results[i].getValue(columns[8])) || 0.00,
                        'totalamount': parseFloat(results[i].getValue(columns[9])) || 0.00,
                        'amountpaid': parseFloat(results[i].getValue(columns[10])) || 0.00,
                        'type': getText('invoice'),
                        'amountwht': 0.00
                    };

                    if (FEAT_INSTALLMENTS == "T" || FEAT_INSTALLMENTS == true) {
                        transaction["installnum"] = results[i].getValue(columns[12]) || "";
                        if (transaction["installnum"]) {
                            transaction["amountdue"] = parseFloat(results[i].getValue(columns[13])) || 0.00;
                            transaction["totalamount"] = parseFloat(results[i].getValue(columns[14])) || 0.00;
                            transaction["amountpaid"] = parseFloat(results[i].getValue(columns[15])) || 0.00;
                        }
                    }

                    if (parseFloat(transaction["amountdue"])) {
                        transactions.push(transaction);
                    }
                }
            }

            transactions = removeInvoicesWithCreditMemos(transactions);

            return transactions
        }

        function removeInvoicesWithCreditMemos(transactions) {
            var appliedInvoices = [];
            for (var i = 0; i < transactions.length; i++) {
                var id = Number(transactions[i]["internalid"]);
                if (transactions[i]["amountpaid"] > 0.00 && appliedInvoices.indexOf(id) == -1) {
                    appliedInvoices.push(id);
                }
            }

            if (appliedInvoices.length) {

                var search_credmemos = search.load({
                    id: 'customsearch_lmry_br_wht_creditmemos'
                });

                search_credmemos.filters.push(search.createFilter({ name: 'appliedtotransaction', operator: 'anyof', values: appliedInvoices }));

                var excludedInvoices = [];
                var results = search_credmemos.run().getRange(0, 1000);
                if (results) {
                    for (var i = 0; i < results.length; i++) {
                        var idTransaction = results[i].getValue('appliedtotransaction');
                        excludedInvoices.push(Number(idTransaction));
                    }
                }

                transactions = transactions.filter(function (v) {
                    return excludedInvoices.indexOf(Number(v["internalid"])) == -1;
                });
            }

            return transactions;
        }

        function loadTransactions(transactions, sublist) {
            var numInstallments = 0;

            for (var i = 0; i < transactions.length; i++) {
                var transaction = transactions[i];
                if (transaction['internalid']) {
                    sublist.setSublistValue({ id: 'apply', line: i, value: 'F' });

                    var url_invoice = url.resolveRecord({
                        recordType: 'invoice',
                        recordId: transaction['internalid'],
                        isEditMode: false
                    });

                    var baselink = '<a class="dottedlink" href ="' + url_invoice + '" target="_blank">#TEXT</a>';

                    if (transaction['date']) {
                        sublist.setSublistValue({ id: 'date', line: i, value: baselink.replace('#TEXT', transaction['date']) });
                    }

                    if (transaction['type']) {
                        sublist.setSublistValue({ id: 'type', line: i, value: baselink.replace('#TEXT', transaction['type']) });
                    }

                    if (transaction['internalid']) {
                        sublist.setSublistValue({ id: 'internalid', line: i, value: transaction['internalid'] });
                    }

                    if (transaction['tranid']) {
                        sublist.setSublistValue({ id: 'tranid', line: i, value: transaction['tranid'] });
                    }

                    if (transaction["installnum"]) {
                        sublist.setSublistValue({ id: 'installnum', line: i, value: transaction["installnum"] });
                        numInstallments++;
                    }

                    if (transaction['customer']) {
                        sublist.setSublistValue({ id: 'customer', line: i, value: transaction['customer'] });
                    }

                    if (transaction['memo']) {
                        sublist.setSublistValue({ id: 'memo', line: i, value: transaction['memo'] });
                    }

                    if (transaction['document']) {
                        sublist.setSublistValue({ id: 'document', line: i, value: transaction['document'] });
                    }

                    if (transaction['currency']) {
                        sublist.setSublistValue({ id: 'currency', line: i, value: transaction['currency'] });
                    }

                    if (transaction['totalamount']) {
                        sublist.setSublistValue({ id: 'totalamount', line: i, value: transaction['totalamount'] });
                    }

                    sublist.setSublistValue({ id: 'amountdue', line: i, value: transaction['amountdue'] || 0.00 });
                }
            }

            if (!numInstallments) {
                var field_installnum = sublist.getField({ id: "installnum" });
                field_installnum.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });
            }
        }


        var TEXT_BY_LANGUAGE = {
            'title': { 'en': 'LatamReady - BR Customer Payment', 'es': 'LatamReady - BR Pago a Cliente', 'pt': 'LatamReady - BR Pagamento do Cliente' },
            'primaryinformation': { 'en': 'Primary Information', 'es': 'Información Primaria', 'pt': 'Informações principais' },
            'subsidiary': { 'en': 'Subsidiary', 'es': 'Subsidiaria', 'pt': 'Subsidiária' },
            'customer': { 'en': 'Customer', 'es': 'Cliente', 'pt': 'Cliente' },
            'currency': { 'en': 'Currency', 'es': 'Moneda', 'pt': 'Moeda' },
            'exchangerate': { 'en': 'Exchange Rate', 'es': 'Tipo de Cambio', 'pt': 'Taxa de câmbio' },
            'araccount': { 'en': 'A/R Account', 'es': 'CUENTA DE CUENTAS POR COBRAR', 'pt': 'CONTA DO CR' },
            'undepfunds': { 'en': 'Undep. Funds', 'es': 'FONDOS SIN DEPOSITAR', 'pt': 'FUNDOS NÃO-DEPOSITADOS' },
            'bankaccount': { 'en': 'Account', 'es': 'Cuenta', 'pt': 'Conta' },
            'date': { 'en': 'Date', 'es': 'Fecha', 'pt': 'Data' },
            'period': { 'en': 'Posting Period', 'es': 'PERÍODO CONTABLE', 'pt': 'PERÍODO DE POSTAGEM' },
            'memo': { 'en': 'Memo', 'es': 'Nota', 'pt': 'Nota' },
            'classification': { 'en': 'Classification', 'es': 'Clasificación', 'pt': 'Classificação' },
            'department': { 'en': 'Department', 'es': 'Departamento', 'pt': 'Departamento' },
            'class': { 'en': 'Class', 'es': 'Clase', 'pt': 'CENTRO DE CUSTO' },
            'location': { 'en': 'Location', 'es': 'UBICACIÓN', 'pt': 'LOCALIDADE' },
            'paymentmethod': { 'en': 'Latam - Payment Method', 'es': 'Latam - Método de pago', 'pt': 'LATAM - MÉTODO DE PAGAMENTO' },
            'filter': { 'en': 'Filter', 'es': 'Filtrar', 'pt': 'Filtrar' },
            'apply': { 'en': 'Apply', 'es': 'Aplicar', 'pt': 'Aplicar' },
            'internalid': { 'en': 'internalid' },
            'tranid': { 'en': 'Ref No.', 'es': '', 'pt': 'Nº DE REFERÊNCIA' },
            'type': { 'en': 'Type', 'es': 'Tipo', 'pt': 'Tipo' },
            'document': { 'en': 'Latam - Legal Document Type' },
            'document_line': { 'en': 'Fiscal Document' },
            'totalamount': { 'en': 'Total Amt.' },
            'amountdue': { 'en': 'Amt. Due' },
            'payment': { 'en': 'Payment', 'es': 'Pago', 'pt': 'Pagamento' },
            'invoices': { 'en': 'Invoices', 'es': 'Facturas de Venta', 'pt': 'Faturas' },
            'invoice': { 'en': 'Invoice', 'es': 'Factura de Venta', 'pt': 'Fatura' },
            'save': { 'en': 'Save', 'es': 'Guardar', 'pt': 'Salvar' },
            'paidall': { 'en': 'Paid All', 'es': 'Pagar todo', 'pt': 'Pagar tudo' },
            'clear': { 'en': 'Clear', 'es': 'Limpiar', 'pt': 'Limpar' },
            'cancel': { 'en': 'Cancel', 'es': 'Cancelar', 'pt': 'Cancelar' },
            'interest': { 'en': 'Interest', 'es': 'Inter&eacute;s', 'pt': 'Juros' },
            'penalty': { 'en': 'Penalty', 'es': 'Multas', 'pt': 'Multas' },
            "installnum": { 'en': 'Installment Number', "es": "Número de cuota", "pt": "NÚMERO DE PRESTAÇÕES" }
        };

        function getText(key) {
            if (TEXT_BY_LANGUAGE[key]) {
                return TEXT_BY_LANGUAGE[key][LANGUAGE] || TEXT_BY_LANGUAGE[key]['en'];
            }
            return '';
        }

        function createCustomSegmentFields(form) {
            var customSegments = [];
            var FEAT_CUSTOMSEGMENTS = runtime.isFeatureInEffect({ feature: "customsegments" });

            if (FEAT_CUSTOMSEGMENTS == true || FEAT_CUSTOMSEGMENTS == "T") {
                //Obtener los custom Segments registrados en el custom record
                var searchSegmentRecords = search.create({
                    type: "customrecord_lmry_setup_cust_segm",
                    filters: [
                        ["isinactive", "is", "F"]
                    ],
                    columns: ["name", "custrecord_lmry_setup_cust_segm"]
                });

                var results = searchSegmentRecords.run().getRange(0, 1000);
                if (results && results.length) {
                    for (var i = 0; i < results.length; i++) {
                        var segmentId = results[i].getValue("custrecord_lmry_setup_cust_segm");
                        var label = results[i].getValue("name") || segmentId;
                        var fieldId = "custpage_" + segmentId;

                        customSegments.push(segmentId);

                        var field = form.addField({
                            id: fieldId,
                            label: label,
                            type: serverWidget.FieldType.SELECT,
                            container: 'clasiffication_group'
                        });

                        addCustomSegmentValues(field, "customrecord_" + segmentId);
                    }
                }
            }

            return customSegments;
        }

        function addCustomSegmentValues(customSegmentField, recordType) {
            var searchValues = search.create({
                type: recordType,
                filters: [
                    ["isinactive", "is", "F"]
                ],
                columns: ["internalid", "name"]
            });

            var results = searchValues.run().getRange(0, 1000);

            customSegmentField.addSelectOption({ value: 0, text: "&nbsp;" });

            for (var i = 0; i < results.length; i++) {
                var id = results[i].getValue("internalid");
                var text = results[i].getValue("name");

                customSegmentField.addSelectOption({ value: id, text: text });
            }
        }

        function getCustomSegments() {
            var customSegments = [];
            var FEAT_CUSTOMSEGMENTS = runtime.isFeatureInEffect({ feature: "customsegments" });

            if (FEAT_CUSTOMSEGMENTS == true || FEAT_CUSTOMSEGMENTS == "T") {
                var searchCustomSegments = search.create({
                    type: "customrecord_lmry_setup_cust_segm",
                    filters: [
                        ["isinactive", "is", "F"]
                    ],
                    columns: [
                        "internalid", "name", "custrecord_lmry_setup_cust_segm"]
                });

                var results = searchCustomSegments.run().getRange(0, 1000);

                if (results && results.length) {
                    for (var i = 0; i < results.length; i++) {
                        var customSegmentId = results[i].getValue("custrecord_lmry_setup_cust_segm");
                        customSegmentId = customSegmentId.trim() || "";
                        if (customSegmentId) {
                            customSegments.push(customSegmentId);
                        }
                    }
                }
            }
            return customSegments;
        }

        return {
            onRequest: onRequest
        }
    });
