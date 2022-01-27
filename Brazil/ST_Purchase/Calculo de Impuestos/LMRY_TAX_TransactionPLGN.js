/**
 * Module Description
 *
 * Version    Date            Author           Remarks
 * 1.00       Jul 2018        LatamReady
 * File : LMRY_TAX_TransactionPLGN.js
 */
var objContext = nlapiGetContext();

var LMRY_script = 'LatamReady - LatamTAX Plug-in';
var featureMB = false;
var featureSubs = false;
var featureDep = false;
var featureLoc = false;
var featureCla = false;
var arreglo_SumaBaseBR = new Array();
var arreglo_IndiceBaseBR = new Array();
var fecha = new Date();
var subsidiary = '';
var entity = 0;
var FEAT_ACC_MAPPING = false;
var reverse = '';
var applyWHT = false;
var FEAT_CUSTOMSEGMENTS = false;
var FEAT_SUITETAX = false;
var customSegments = [];
var Json_GMA = {};
var licenses = [];

// SuiteTax
var ST_FEATURE = false;

function customizeGlImpact(transactionRecord, standardLines, customLines, book) {

  try {

    var country = transactionRecord.getFieldText("custbody_lmry_subsidiary_country");
    if (country != '' && country != null) {
      country = country.substring(0, 3).toUpperCase();
    }

    var transactionType = transactionRecord.getRecordType();

    if (!validateMemo(transactionRecord)) {
      return true;
    }

    //FEATURES 3.0
    licenses = getLicenses(transactionRecord.getFieldValue('subsidiary'));

    var flag = validarPais(country, transactionType, licenses);
    if (flag == false) {
      return true;
    }
    var usageRemaining = objContext.getRemainingUsage();
    nlapiLogExecution("ERROR", "Unidades de memoria", usageRemaining);

    //Obteniendo features de localizacion
    featureDep = objContext.getSetting('FEATURE', 'DEPARTMENTS');
    featureLoc = objContext.getSetting('FEATURE', 'LOCATIONS');
    featureCla = objContext.getSetting('FEATURE', 'CLASSES');

    //Obteniendo features de instancia
    featureSubs = objContext.getFeature('SUBSIDIARIES');
    featureMB = objContext.getFeature('MULTIBOOK');

    // Obteniendo feature de SuiteTax
    ST_FEATURE = objContext.getFeature('tax_overhauling');

    if (ST_FEATURE == true || ST_FEATURE == "T") {
        if(getAuthorization(755, licenses) == true) {
            return true;
        }
    }

    entity = transactionRecord.getFieldValue("entity");
    fecha = transactionRecord.getFieldValue("trandate");
    var locationTransaction = transactionRecord.getFieldValue("location");
    reverse = transactionRecord.getFieldValue("custbody_lmry_br_reverse_gl_impact");
    if (!reverse) {
      reverse = 0;
    }

    FEAT_ACC_MAPPING = objContext.getFeature('coaclassificationmanagement');
    FEAT_CUSTOMSEGMENTS = objContext.getFeature("customsegments");
    FEAT_SUITETAX = objContext.getFeature("tax_overhauling");

    if (featureSubs) {
      subsidiary = transactionRecord.getFieldValue("subsidiary");
    } else {
      subsidiary = 1;
    }

    //Obtiene el Global Account Mapping
    if (featureMB == true || featureMB == 'T') {
      obtainsAccounts(book.getId());
    }

    var idTransaction = nlapiGetRecordId();

    nlapiLogExecution("DEBUG", "transactionType", transactionType);
    var isTaxCalculator = checkIsTaxCalculator(transactionRecord);
    nlapiLogExecution("DEBUG", "isTaxCalculator", isTaxCalculator);

    var isHybrid = false;
    if (getAuthorization(722, licenses)) {
      isHybrid = transactionRecord.getFieldValue("custbody_lmry_tax_tranf_gratu");
      isHybrid = (isHybrid == true || isHybrid == "T");
    }

    nlapiLogExecution("DEBUG", "isHybrid", isHybrid);

    if (!isTaxCalculator || isHybrid) {
      // Variable con el id de la transaccion que se enviara como filtro para la CC y NT
      var filtroTransactionType;
      switch (transactionType) {
        case 'invoice':
          filtroTransactionType = 1;
          break;
        case 'creditmemo':
          filtroTransactionType = 8;
          break;
        case 'vendorbill':
          filtroTransactionType = 4;
          break;
        case 'vendorcredit':
          filtroTransactionType = 7;
          break;
        case 'salesorder':
          filtroTransactionType = 2;
          break;
        case 'estimate':
          filtroTransactionType = 10;
          break;
        case 'purchaseorder':
          filtroTransactionType = 6;
          break;
        default:
          return true;
      }
      //nlapiLogExecution('ERROR', 'filtroTransactionType', filtroTransactionType);

      customSegments = getCustomSegments();
      nlapiLogExecution("ERROR", "customSegments", JSON.stringify(customSegments));

      var arreglo_Items = [];
      var grossamt;
      var netamt;
      var taxamt = transactionRecord.getFieldValue("taxtotal");
      if (taxamt == null || taxamt == '') {
        taxamt = 0;
      }
      if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 8 || filtroTransactionType == 10) { // Si es una transaccion de Ventas
        netamt = transactionRecord.getFieldValue("subtotal");
        grossamt = parseFloat(netamt) + parseFloat(taxamt);
      } else { // Si es una transaccion de Compras
        grossamt = transactionRecord.getFieldValue("usertotal");
        netamt = parseFloat(grossamt) - parseFloat(taxamt);
      }

      // Se redondean todos los montos a dos decimales
      netamt = parseFloat(Math.round(parseFloat(netamt) * 100) / 100);
      taxamt = parseFloat(Math.round(parseFloat(taxamt) * 100) / 100);
      grossamt = parseFloat(Math.round(parseFloat(grossamt) * 100) / 100);

      var grossamtInicial = grossamt;
      var netamtInicial = netamt;
      var taxamtInicial = taxamt;

      var documentType = transactionRecord.getFieldValue("custbody_lmry_document_type");
      applyWHT = transactionRecord.getFieldValue("custbody_lmry_apply_wht_code");
      var province = transactionRecord.getFieldValue("custbody_lmry_province");
      var city = transactionRecord.getFieldValue("custbody_lmry_city");
      var district = transactionRecord.getFieldValue("custbody_lmry_district");
      //nlapiLogExecution("ERROR", "documentType", documentType);

      //Se cargan valores de cabecera del Custom Segments.
      var transactionSegments = {}
      for (var i = 0; i < customSegments.length; i++) {
        if (transactionRecord.getFieldValue(customSegments[i])) {
          transactionSegments[customSegments[i]] = transactionRecord.getFieldValue(customSegments[i]);
        }
      }

      var retencion = 0;
      var baseAmount = 0;
      var compareAmount = 0;
      var cantidad_items = transactionRecord.getLineItemCount("item");
      var cantidad_expenses = 0;
      if (filtroTransactionType == 4 || filtroTransactionType == 7) {
        cantidad_expenses = transactionRecord.getLineItemCount("expense");
      }

      var discountAmounts = getDiscountAmounts(transactionRecord);
      nlapiLogExecution("ERROR", "discountAmounts", JSON.stringify(discountAmounts));

      /**********************************************************
       * Busqueda en el record: LatamReady - Setup Tax Subsidiary
       **********************************************************/
      var clasificacionCC = false,
        summary = false,
        accountCC = false,
        rounding = "",
        depSetup = "",
        classSetup = "",
        locSetup = "";
      var currencySetup = "";
      var taxCalculationForm = 1;
      var filterLoc = false;
      var apTaxFlow = 1;
      var filtros = new Array();
      filtros[0] = new nlobjSearchFilter("isinactive", null, "is", ['F']);
      if (featureSubs) {
        filtros[1] = new nlobjSearchFilter("custrecord_lmry_setuptax_subsidiary", null, "is", [subsidiary]);
      }
      var columnas = new Array();
      columnas[0] = new nlobjSearchColumn("custrecord_lmry_setuptax_subsidiary");
      columnas[1] = new nlobjSearchColumn("custrecord_lmry_setuptax_depclassloc");
      columnas[2] = new nlobjSearchColumn("custrecord_lmry_setuptax_summarized_gl");
      columnas[3] = new nlobjSearchColumn("custrecord_lmry_setuptax_account");
      columnas[4] = new nlobjSearchColumn("custrecord_lmry_setuptax_type_rounding");
      columnas[5] = new nlobjSearchColumn("custrecord_lmry_setuptax_department");
      columnas[6] = new nlobjSearchColumn("custrecord_lmry_setuptax_class");
      columnas[7] = new nlobjSearchColumn("custrecord_lmry_setuptax_location");
      columnas[8] = new nlobjSearchColumn("custrecord_lmry_setuptax_currency");
      columnas[9] = new nlobjSearchColumn("custrecord_lmry_setuptax_br_taxfromgross");
      columnas[10] = new nlobjSearchColumn("custrecord_lmry_setuptax_br_filterloc");
      columnas[11] = new nlobjSearchColumn("custrecord_lmry_setuptax_br_ap_flow");

      var searchSetupSubsidiary = nlapiCreateSearch("customrecord_lmry_setup_tax_subsidiary", filtros, columnas);
      var resultSearchSub = searchSetupSubsidiary.runSearch().getResults(0, 1000);

      if (resultSearchSub.length != null && resultSearchSub.length > 0) {
        clasificacionCC = resultSearchSub[0].getValue("custrecord_lmry_setuptax_depclassloc");
        summary = resultSearchSub[0].getValue("custrecord_lmry_setuptax_summarized_gl");
        accountCC = resultSearchSub[0].getValue("custrecord_lmry_setuptax_account");
        rounding = resultSearchSub[0].getValue("custrecord_lmry_setuptax_type_rounding");
        depSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_department");
        classSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_class");
        locSetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_location");
        currencySetup = resultSearchSub[0].getValue("custrecord_lmry_setuptax_currency");
        taxCalculationForm = resultSearchSub[0].getValue("custrecord_lmry_setuptax_br_taxfromgross") || 1;
        taxCalculationForm = Number(taxCalculationForm);
        filterLoc = resultSearchSub[0].getValue("custrecord_lmry_setuptax_br_filterloc");
        apTaxFlow = resultSearchSub[0].getValue("custrecord_lmry_setuptax_br_ap_flow") || 1;
        //nlapiLogExecution('ERROR', 'filterLoc', filterLoc);
      }

      /*******************************************************************************************
       * Obtención del ExchangeRate de la transaccion o Multibook para la conversión a moneda base
       *******************************************************************************************/
      // Si se debe filtrar por Location y el Location de la transaccion está vacio, no realiza el flujo
      if (filterLoc == true || filterLoc == 'T') {
        if (locationTransaction == '' || locationTransaction == null) {
          return true;
        }
      }

      var exchangeRate = 1;
      var currency = transactionRecord.getFieldValue("currency");

      if (featureSubs && featureMB) { // OneWorld y Multibook
        var currencySubs = nlapiLookupField('subsidiary', subsidiary, 'currency');
        //nlapiLogExecution('ERROR', 'currencySubs', currencySubs);

        if (currencySubs != currencySetup && currencySetup != '' && currencySetup != null) {
          var lineasBook = transactionRecord.getLineItemCount("accountingbookdetail");
          //nlapiLogExecution('ERROR', 'lineasBook', lineasBook);
          if (lineasBook != null && lineasBook != '') {
            for (var i = 1; i <= lineasBook; i++) {
              var lineaCurrencyMB = transactionRecord.getLineItemValue("accountingbookdetail", "currency", i);
              //nlapiLogExecution('ERROR', 'lineaCurrencyMB', lineaCurrencyMB);
              if (lineaCurrencyMB == currencySetup) {
                exchangeRate = transactionRecord.getLineItemValue("accountingbookdetail", "exchangerate", i);
                break;
              }
            }
          }
        } else { // La moneda de la subsidiaria es igual a la moneda del setup
          exchangeRate = transactionRecord.getFieldValue("exchangerate");
        }
      } else { // No es OneWorld o no tiene Multibook
        exchangeRate = transactionRecord.getFieldValue("exchangerate");
      }
      exchangeRate = parseFloat(exchangeRate);
      //nlapiLogExecution('ERROR', 'exchangeRate', exchangeRate);

      // Variables de Preferencias Generales
      var prefDep = objContext.getPreference('DEPTMANDATORY');
      var prefLoc = objContext.getPreference('LOCMANDATORY');
      var prefClas = objContext.getPreference('CLASSMANDATORY');
      var prefDepLine = objContext.getPreference('DEPTSPERLINE');
      var prefClassLine = objContext.getPreference('CLASSESPERLINE');

      //nlapiLogExecution("ERROR", 'prefDep , prefLoc , prefClas', prefDep + ' , ' + prefLoc + ' , ' + prefClas);
      var salesTransactionTypes = ["invoice", "creditmemo", "salesorder", "estimate"];

      //Transaccion de ventas y estado 2 : Calculo de impuestos
      if (salesTransactionTypes.indexOf(transactionType) != -1) {

        var sumaBaseCalculoT = 0;
        var sumaBaseCalculoI = 0;
        var blnBaseCalculoI = false;
        var m = 9;

        /********************************************************
         * Busqueda en el record: LatamReady - Contributory Class
         ********************************************************/
        // Filtros
        var filtrosCC = [
          ['isinactive', 'is', 'F'], 'AND',
          ['custrecord_lmry_ar_ccl_fechdesd', 'onorbefore', fecha], 'AND',
          ['custrecord_lmry_ar_ccl_fechhast', 'onorafter', fecha], 'AND',
          ['custrecord_lmry_ccl_transactiontypes', 'anyof', filtroTransactionType], 'AND',
          ['custrecord_lmry_ar_ccl_entity', 'anyof', entity], 'AND',
          ['custrecord_lmry_ccl_appliesto', 'anyof', ["1", "2"]], 'AND',
          ['custrecord_lmry_ccl_taxtype', 'anyof', '4'], 'AND',
          ['custrecord_lmry_ccl_gen_transaction', 'anyof', '2']
        ];

        var documents = ['@NONE@'];
        if (documentType) {
          documents.push(documentType);
        }
        filtrosCC.push('AND', ['custrecord_lmry_ccl_fiscal_doctype', 'anyof', documents]);

        if (filterLoc == 'T' || filterLoc == true) {
          filtrosCC.push('AND', ['custrecord_lmry_ar_ccl_location', 'anyof', locationTransaction]);
        }

        if (featureSubs == 'T' || featureSubs == true) {
          filtrosCC.push('AND', ['custrecord_lmry_ar_ccl_subsidiary', 'anyof', subsidiary])
        }

        if (accountCC == 'T' || accountCC == true) {
          filtrosCC.push("AND", ["custrecord_lmry_br_ccl_account1", "noneof", "@NONE@"],
            "AND", ["custrecord_lmry_br_ccl_account2", "noneof", "@NONE@"]);
        }

        var provinces = ['@NONE@'];
        if (province) {
          provinces.push(province);
        }

        var cities = ['@NONE@'];
        if (city) {
          cities.push(city)
        }

        var districts = ['@NONE@'];
        if (district) {
          districts.push(district);
        }

        filtrosCC.push('AND', [
          [
            ["custrecord_lmry_sub_type.custrecord_lmry_tax_by_location", "is", "F"]
          ]
          , "OR", [
            ["custrecord_lmry_sub_type.custrecord_lmry_tax_by_location", "is", "T"],
            'AND', ["custrecord_lmry_ccl_province", "anyof", provinces],
            'AND', ["custrecord_lmry_ccl_city", "anyof", cities],
            'AND', ["custrecord_lmry_ccl_district", "anyof", districts]
          ]
        ]);

        var catalogFilters = getCatalogFilters(transactionRecord, taxCalculationForm, "custrecord_lmry_br_ccl_catalog", "custrecord_lmry_ccl_nfce_catalog_id");
        nlapiLogExecution("DEBUG", "catalogFilters", JSON.stringify(catalogFilters));
        if (catalogFilters.length) {
          filtrosCC.push("AND", catalogFilters);
        }

        if (taxCalculationForm != 4 || !isHybrid) {
          filtrosCC.push("AND", ["custrecord_lmry_ccl_is_hybrid", "is", "F"]);
        }

        // Columnas
        var columnas = new Array();
        columnas[0] = new nlobjSearchColumn("custrecord_lmry_ccl_appliesto").setSort(false);
        columnas[1] = new nlobjSearchColumn("custrecord_lmry_br_ccl_catalog").setSort(false);
        columnas[2] = new nlobjSearchColumn("custrecord_lmry_br_exclusive").setSort(false);
        columnas[3] = new nlobjSearchColumn("custrecord_lmry_ar_ccl_taxrate");
        columnas[4] = new nlobjSearchColumn("custrecord_lmry_amount");
        columnas[5] = new nlobjSearchColumn("custrecord_lmry_sub_type");
        columnas[6] = new nlobjSearchColumn("custrecord_lmry_ccl_minamount");
        columnas[7] = new nlobjSearchColumn("custrecord_lmry_br_ccl_account1");
        columnas[8] = new nlobjSearchColumn("custrecord_lmry_br_ccl_account2");
        columnas[9] = new nlobjSearchColumn("custrecord_lmry_ccl_applies_to_item");
        columnas[10] = new nlobjSearchColumn("custrecord_lmry_ccl_applies_to_account");
        columnas[11] = new nlobjSearchColumn("custrecord_lmry_ar_ccl_department");
        columnas[12] = new nlobjSearchColumn("custrecord_lmry_ar_ccl_class");
        columnas[13] = new nlobjSearchColumn("custrecord_lmry_ar_ccl_location");
        columnas[14] = new nlobjSearchColumn("custrecord_lmry_ccl_addratio");
        columnas[15] = new nlobjSearchColumn("custrecord_lmry_ec_ccl_catalog");
        columnas[16] = new nlobjSearchColumn("custrecord_lmry_ccl_maxamount");
        columnas[17] = new nlobjSearchColumn("custrecord_lmry_ccl_accandmin_with");
        columnas[18] = new nlobjSearchColumn("custrecord_lmry_ccl_not_taxable_minimum");
        columnas[19] = new nlobjSearchColumn("custrecord_lmry_ccl_base_amount");
        columnas[20] = new nlobjSearchColumn("custrecord_lmry_ccl_set_baseretention");
        columnas[21] = new nlobjSearchColumn("custrecord_lmry_ccl_gen_transaction");
        columnas[22] = new nlobjSearchColumn("custrecord_lmry_br_ccl_rate_suma");

        if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 8 || filtroTransactionType == 10) {
          columnas[23] = new nlobjSearchColumn('incomeaccount', "custrecord_lmry_ar_ccl_taxitem");
        } else {
          columnas[23] = new nlobjSearchColumn('expenseaccount', "custrecord_lmry_ar_ccl_taxitem");
        }

        columnas[24] = new nlobjSearchColumn("custrecord_lmry_tax_by_location", "custrecord_lmry_sub_type");
        columnas[25] = new nlobjSearchColumn("custrecord_lmry_ccl_config_segment");
        columnas[26] = new nlobjSearchColumn("custrecord_lmry_is_tax_not_included", "custrecord_lmry_sub_type");
        columnas[27] = new nlobjSearchColumn("custrecord_lmry_ccl_is_substitution");
        columnas[28] = new nlobjSearchColumn("custrecord_lmry_ccl_nfce_catalog_id");
        columnas[29] = new nlobjSearchColumn("custrecord_lmry_ccl_is_hybrid");
        columnas[30] = new nlobjSearchColumn("custrecord_lmry_ccl_hybrid_part");

        var searchCC = nlapiCreateSearch("customrecord_lmry_ar_contrib_class", filtrosCC, columnas);
        var searchResultCC = searchCC.runSearch().getResults(0, 1000);

        //nlapiLogExecution("ERROR", "Cantidad de ccls", searchResultCC.length);

        if (searchResultCC != null && searchResultCC.length > 0) {

          // Brasil : Calculo del Monto Base para el Flujo 0 y 2
          if (country.toUpperCase() == 'BRA' && (taxCalculationForm == 1 || taxCalculationForm == 3)) {
            var suma = parseFloat(sumaPorcentajes(searchResultCC, '1', 'custrecord_lmry_ccl_appliesto', 'custrecord_lmry_ar_ccl_taxrate', 'custrecord_lmry_br_ccl_rate_suma', '', '', 'custrecord_lmry_sub_type'));
            grossamt = parseFloat(grossamtInicial / parseFloat(1 - suma));
            netamt = parseFloat(netamtInicial / parseFloat(1 - suma));
            taxamt = parseFloat(taxamtInicial / parseFloat(1 - suma));
          }

          for (var i = 0; i < searchResultCC.length; i++) {

            var colColums = searchResultCC[i].getAllColumns();
            var taxrate = searchResultCC[i].getValue("custrecord_lmry_ar_ccl_taxrate");
            var amount_to = searchResultCC[i].getValue("custrecord_lmry_amount");
            var applies_to = searchResultCC[i].getValue("custrecord_lmry_ccl_appliesto");
            var subtype = searchResultCC[i].getText("custrecord_lmry_sub_type");
            var idsubtype = searchResultCC[i].getValue("custrecord_lmry_sub_type");
            var min_amount = searchResultCC[i].getValue("custrecord_lmry_ccl_minamount");
            var account1 = searchResultCC[i].getValue("custrecord_lmry_br_ccl_account1");
            var account2 = searchResultCC[i].getValue("custrecord_lmry_br_ccl_account2");
            var applies_item = searchResultCC[i].getValue("custrecord_lmry_ccl_applies_to_item");
            var applies_account = searchResultCC[i].getValue("custrecord_lmry_ccl_applies_to_account");
            var department = searchResultCC[i].getValue("custrecord_lmry_ar_ccl_department");
            var class_ = searchResultCC[i].getValue("custrecord_lmry_ar_ccl_class");
            var location = searchResultCC[i].getValue("custrecord_lmry_ar_ccl_location");
            var catalog_br = searchResultCC[i].getValue("custrecord_lmry_br_ccl_catalog");
            var ratio = searchResultCC[i].getValue("custrecord_lmry_ccl_addratio");
            var catalog_ec = searchResultCC[i].getValue("custrecord_lmry_ec_ccl_catalog");
            var max_amount = searchResultCC[i].getValue("custrecord_lmry_ccl_maxamount");
            var amount_to_compare = searchResultCC[i].getValue("custrecord_lmry_ccl_accandmin_with");
            var not_taxable_minimun = searchResultCC[i].getValue("custrecord_lmry_ccl_not_taxable_minimum");
            var how_base_amount = searchResultCC[i].getValue("custrecord_lmry_ccl_base_amount");
            var base_retention = searchResultCC[i].getValue("custrecord_lmry_ccl_set_baseretention");
            var genera = searchResultCC[i].getValue("custrecord_lmry_ccl_gen_transaction");
            var is_exclusive = searchResultCC[i].getValue("custrecord_lmry_br_exclusive");
            var isTaxByLocation = searchResultCC[i].getValue("custrecord_lmry_tax_by_location", "custrecord_lmry_sub_type");
            var isTaxNotIncluded = searchResultCC[i].getValue("custrecord_lmry_is_tax_not_included", "custrecord_lmry_sub_type");
            var isSubstitutionTax = searchResultCC[i].getValue("custrecord_lmry_ccl_is_substitution");
            var nfceCatalog = searchResultCC[i].getValue("custrecord_lmry_ccl_nfce_catalog_id") || "";
            nfceCatalog = Number(nfceCatalog);
            var isHybridTax = searchResultCC[i].getValue("custrecord_lmry_ccl_is_hybrid");
            isHybridTax = (isHybridTax == true || isHybridTax == "T");
            var hybridPercent = searchResultCC[i].getValue("custrecord_lmry_ccl_hybrid_part");
            hybridPercent = parseFloat(hybridPercent) || 1;

            if (Number(taxCalculationForm) != 4) {
              isTaxNotIncluded = false;
              isSubstitutionTax = false;
            }

            var taxItemCuenta = '';
            if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 8 || filtroTransactionType == 10) {
              taxItemCuenta = searchResultCC[i].getValue(colColums[23]);
            } else {
              taxItemCuenta = searchResultCC[i].getValue(colColums[23]);
            }

            var segmentsCC = searchResultCC[i].getValue("custrecord_lmry_ccl_config_segment");
            if (segmentsCC) {
              segmentsCC = JSON.parse(segmentsCC);
            }

            //nlapiLogExecution('ERROR', 'taxItemCuenta', taxItemCuenta);
            retencion = 0;
            baseAmount = 0;
            compareAmount = 0;

            // Conversion de los montos de la CC a moneda de la transaccion
            if (min_amount == null || min_amount == '') { // Entidad - Totales - Minimo
              min_amount = 0;
            }
            min_amount = parseFloat(parseFloat(min_amount) / exchangeRate);
            if (max_amount == null || max_amount == '') { // Entidad - Totales / Items - Maximo
              max_amount = 0;
            }
            max_amount = parseFloat(parseFloat(max_amount) / exchangeRate);
            if (base_retention == null || base_retention == '') {
              base_retention = 0;
            }
            base_retention = parseFloat(parseFloat(base_retention) / exchangeRate);
            if (not_taxable_minimun == null || not_taxable_minimun == '') {
              not_taxable_minimun = 0;
            }
            not_taxable_minimun = parseFloat(parseFloat(not_taxable_minimun) / exchangeRate);
            if (ratio == null || ratio == '') {
              ratio = 1;
            }
            if (amount_to_compare == '' || amount_to_compare == null) {
              amount_to_compare = amount_to;
            }

            if ((applyWHT == true || applyWHT == 'T') && (isTaxByLocation == true || isTaxByLocation == 'T')) {
              continue;
            }

            if ((isTaxNotIncluded == "T" || isTaxNotIncluded == true) || (isSubstitutionTax == "T" || isSubstitutionTax == true)) {
              continue;
            }

            // Caso 1 : Entidad - Totales
            if (applies_to == 1) {

              if (genera == '1') { // Si genera Journal sale del proceso
                continue;
              }

              if (country.toUpperCase() == 'BRA') {
                if (taxCalculationForm == 1 || taxCalculationForm == 3) { // Flujo 0 y 2
                  amount_to = '3'; // Trabaja con el Gross Amount siempre
                  if ((is_exclusive == true || is_exclusive == 'T') && sumaBaseCalculoT > 0) {
                    grossamt = parseFloat(grossamt) - parseFloat(sumaBaseCalculoT);
                    netamt = parseFloat(netamt) - parseFloat(sumaBaseCalculoT);
                    taxamt = parseFloat(taxamt) - parseFloat(sumaBaseCalculoT);
                    sumaBaseCalculoT = 0;
                  }
                } else {
                  amount_to = '1'; // Trabaja con el Gross Amount siempre
                  if (taxCalculationForm == 4) {
                    if ((is_exclusive == true || is_exclusive == 'T') && sumaBaseCalculoT > 0) {
                      grossamt = parseFloat(grossamt) - parseFloat(sumaBaseCalculoT);
                      sumaBaseCalculoT = 0;
                    }
                  }
                }
              }

              if (taxamt == 0 && amount_to == 2) {
                continue;
              }

              // Calculo del Monto Base
              switch (amount_to) {
                case '1':
                  baseAmount = parseFloat(grossamt) - parseFloat(not_taxable_minimun);
                  break;
                case '2':
                  baseAmount = parseFloat(taxamt) - parseFloat(not_taxable_minimun);
                  break;
                case '3':
                  baseAmount = parseFloat(netamt) - parseFloat(not_taxable_minimun);
                  break;
              }
              baseAmount = parseFloat(baseAmount);
              // Calculo del Monto a Comparar
              if (amount_to_compare == amount_to) {
                compareAmount = parseFloat(baseAmount);
              } else {
                switch (amount_to_compare) {
                  case '1':
                    compareAmount = parseFloat(grossamt);
                    break;
                  case '2':
                    compareAmount = parseFloat(taxamt);
                    break;
                  case '3':
                    compareAmount = parseFloat(netamt);
                    break;
                }
              }

              if (how_base_amount != null && how_base_amount != '') {
                switch (how_base_amount) {
                  case '2': // Substrac Minimun
                    baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                    break;
                  case '3': // Minimun
                    baseAmount = parseFloat(min_amount);
                    break;
                  case '4': // Maximun
                    baseAmount = parseFloat(max_amount);
                    break;

                }
              }
              baseAmount = parseFloat(baseAmount);
              if (baseAmount <= 0) {
                continue;
              }

              // Calculo de retencion
              if (max_amount != 0) {
                if (min_amount <= parseFloat(compareAmount) && parseFloat(compareAmount) <= max_amount) {
                  retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                }
              } else {
                if (min_amount <= parseFloat(compareAmount)) {
                  retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                }
              }

              //nlapiLogExecution("ERROR", "CC - Retencion", i + ' - ' + retencion);
              if (parseFloat(retencion) > 0 || round2(parseFloat(retencion)) > 0) {
                var retencionAuxRound = round2(parseFloat(retencion));
                retencion = round(parseFloat(retencion), 7);
                if (featureMB) {
                  retencionAuxRound = tipoCambioMB(transactionRecord, book, retencionAuxRound, rounding);
                }
                //nlapiLogExecution("ERROR", 'retencionAuxRound - decimal', retencionAuxRound + ' - ' + decimal);
                if (parseFloat(retencionAuxRound) > 0) {
                  // Para Brasil se consideran los impuestos de telecomunicacion (campo is_exclusive) solo para el Flujo 0,2,3
                  var telecommTaxesFlows = [1, 3, 4]; //Flujos con impuestos de telecomunicaciones (FUST y FUNTEL)
                  if (country.toUpperCase() == 'BRA' && (is_exclusive != true && is_exclusive != 'T') && telecommTaxesFlows.indexOf(Number(taxCalculationForm)) != -1) {
                    sumaBaseCalculoT = sumaBaseCalculoT + parseFloat(retencion);
                  }

                  var cuentaDebit_Total = '';
                  var cuentaCredit_Total = '';

                  if (accountCC == false || accountCC == 'F') { // Cuentas del Item y Transaccion
                    if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 10 || filtroTransactionType == 7) { // Invoice - Sales Order - Estimate - Bill Credit
                      cuentaDebit_Total = parseFloat(taxItemCuenta); // Debito - Cuenta del Item
                      cuentaCredit_Total = parseFloat(transactionRecord.getFieldValue("account")); // Credito - Cuenta de la transaccion
                    }
                    if (filtroTransactionType == 4) { // Bill
                      cuentaDebit_Total = parseFloat(transactionRecord.getFieldValue("account")); // Debito - Cuenta de la transaccion
                      cuentaCredit_Total = parseFloat(taxItemCuenta); // Credito - Cuenta del Item
                    }
                    if (filtroTransactionType == 8) { // Credit Memo
                      if (reverse == 1) {
                        cuentaDebit_Total = parseFloat(taxItemCuenta); // Credito - Cuenta del Item
                        cuentaCredit_Total = parseFloat(transactionRecord.getFieldValue("account")); // Debito - Cuenta de la transaccion
                      } else {
                        cuentaDebit_Total = parseFloat(transactionRecord.getFieldValue("account")); // Debito - Cuenta de la transaccion
                        cuentaCredit_Total = parseFloat(taxItemCuenta); // Credito - Cuenta del Item
                      }
                    }
                  } else { // Cuentas de la CC
                    if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 10 || filtroTransactionType == 4) { // Invoice - Sales Order - Estimate - Bill
                      var cuentaDebit_Total = parseFloat(account1); // Cuenta Debito - CC
                      var cuentaCredit_Total = parseFloat(account2); // Cuenta Credito - CC
                    }
                    if (filtroTransactionType == 7) { // Bill Credit
                      var cuentaDebit_Total = parseFloat(account2); // Cuenta Credito - CC
                      var cuentaCredit_Total = parseFloat(account1); // Cuenta Debito - CC
                    }
                    if (filtroTransactionType == 8) { // Credit Memo
                      if (reverse == 1) {
                        var cuentaDebit_Total = parseFloat(account1); // Cuenta Debito - CC
                        var cuentaCredit_Total = parseFloat(account2); // Cuenta Credito - CC
                      } else {
                        var cuentaDebit_Total = parseFloat(account2); // Cuenta Credito - CC
                        var cuentaCredit_Total = parseFloat(account1); // Cuenta Debito - CC
                      }
                    }
                  }

                  if (clasificacionCC == true || clasificacionCC == 'T') { // Segmentacion de la Clase Contributiva
                    var dep1 = elegirSegmentacion(prefDep, department, transactionRecord.getFieldValue("department"), depSetup, transactionRecord.getFieldValue("department"));
                    var cla1 = elegirSegmentacion(prefClas, class_, transactionRecord.getFieldValue("class"), classSetup, transactionRecord.getFieldValue("class"));
                    var loc1 = elegirSegmentacion(prefLoc, location, transactionRecord.getFieldValue("location"), locSetup, transactionRecord.getFieldValue("location"));
                  } else { // Segmentacion de la Transaccion
                    var dep1 = elegirSegmentacion(prefDep, transactionRecord.getFieldValue("department"), department, depSetup, '');
                    var cla1 = elegirSegmentacion(prefClas, transactionRecord.getFieldValue("class"), class_, classSetup, '');
                    var loc1 = elegirSegmentacion(prefLoc, transactionRecord.getFieldValue("location"), location, locSetup, '');
                  }
                  // Cuenta dependiendo del Libro Contable
                  if (!book.isPrimary()) {
                    cuentaDebit_Total = getAccount(cuentaDebit_Total, dep1, cla1, loc1);
                    cuentaCredit_Total = getAccount(cuentaCredit_Total, dep1, cla1, loc1);
                  }

                  var newLineDebit = customLines.addNewLine();
                  newLineDebit.setDebitAmount(retencionAuxRound);
                  newLineDebit.setAccountId(parseFloat(cuentaDebit_Total));
                  newLineDebit.setMemo(subtype + ' (LatamTax - Contributory Class)');
                  if (dep1 != '' && dep1 != null && dep1 != 0 && (prefDepLine == true || prefDepLine == 'T')) {
                    newLineDebit.setDepartmentId(parseInt(dep1));
                  }
                  if (cla1 != '' && cla1 != null && cla1 != 0 && (prefClassLine == true || prefClassLine == 'T')) {
                    newLineDebit.setClassId(parseInt(cla1));
                  }
                  if (loc1 != '' && loc1 != null && loc1 != 0) {
                    newLineDebit.setLocationId(parseInt(loc1));
                  }

                  if (customSegments.length) {
                    for (var s = 0; s < customSegments.length; s++) {
                      var segmentId = customSegments[s];
                      var segmentValue = segmentsCC[segmentId] || transactionSegments[segmentId] || "";
                      if (segmentValue) {
                        newLineDebit.setSegmentValueId(segmentId, parseInt(segmentValue));
                      }
                    }
                  }

                  newLineDebit.setEntityId(parseInt(entity));

                  var newLineCredit = customLines.addNewLine();
                  newLineCredit.setCreditAmount(retencionAuxRound);
                  newLineCredit.setAccountId(parseFloat(cuentaCredit_Total));
                  newLineCredit.setMemo(subtype + ' (LatamTax - Contributory Class)');
                  if (dep1 != '' && dep1 != null && dep1 != 0 && (prefDepLine == true || prefDepLine == 'T')) {
                    newLineCredit.setDepartmentId(parseInt(dep1));
                  }
                  if (cla1 != '' && cla1 != null && cla1 != 0 && (prefClassLine == true || prefClassLine == 'T')) {
                    newLineCredit.setClassId(parseInt(cla1));
                  }
                  if (loc1 != '' && loc1 != null && loc1 != 0) {
                    newLineCredit.setLocationId(parseInt(loc1));
                  }


                  if (customSegments.length) {
                    for (var s = 0; s < customSegments.length; s++) {
                      var segmentId = customSegments[s];
                      var segmentValue = segmentsCC[segmentId] || transactionSegments[segmentId] || "";

                      if (segmentValue) {
                        newLineCredit.setSegmentValueId(segmentId, parseInt(segmentValue));
                      }
                    }
                  }

                  newLineCredit.setEntityId(parseInt(entity));
                }
              } // Fin Retencion > 0
            } // Fin Caso 1 : Entidad - Totales

            // Caso 2I / 2E : Entidad - Items / Expenses
            else {
              //nlapiLogExecution("ERROR", 'applies_item', applies_item);
              //nlapiLogExecution("ERROR", 'applies_account', applies_account);

              // Caso 2I : Entidad - Items
              if (catalog_br || nfceCatalog || applies_item) {
                for (var j = 1; j <= cantidad_items; j++) {
                  var idItem = transactionRecord.getLineItemValue("item", "item", j);

                  var typeDiscount = transactionRecord.getLineItemValue("item", "custcol_lmry_col_sales_type_discount", j);

                  var discountAmt = discountAmounts[String(j)] || 0.00;
                  var flagItem = false;

                  //Solo considera descuentos para los flujos 0 y 3 y para Descuento no condicional
                  if ([1, 4].indexOf(Number(taxCalculationForm)) == -1) {
                    discountAmt = 0;
                  }

                  if (typeDiscount) {
                    continue;
                  }


                  var catalogItem = transactionRecord.getLineItemValue('item', 'custcol_lmry_br_service_catalog', j) || "";

                  if (catalogItem && (catalogItem == catalog_br)) {
                    flagItem = true;
                  }

                  if (!flagItem && idItem && (idItem == applies_item)) {
                    flagItem = true;
                  }

                  var nfceCatalogLine = transactionRecord.getLineItemValue("item", "custcol_lmry_br_nfce_catalog", j) || "";
                  nfceCatalogLine = Number(nfceCatalogLine);

                  nlapiLogExecution("DEBUG", "catalogItem,idItem,nfceCatalogLine", [catalogItem, idItem, nfceCatalogLine].join("-"));

                  if (isHybrid) {
                    if (!flagItem && nfceCatalogLine && (nfceCatalog == nfceCatalogLine)) {
                      flagItem = true;
                    }

                    var isHybridLine = false;
                    if (nfceCatalogLine && catalogItem) { //Si tiene ambos catalogos
                      isHybridLine = true;
                    }

                    if ((isHybridTax && !isHybridLine) || (!isHybridTax && isHybridLine)) {
                      continue;
                    }
                  }

                  var isTaxItem = transactionRecord.getLineItemValue("item", "custcol_lmry_ar_item_tributo", j);

                  if (isTaxItem == "T" || isTaxItem == true) {
                    continue;
                  }

                  retencion = 0;
                  if (flagItem == true) {

                    var grossamtItem = transactionRecord.getLineItemValue("item", "grossamt", j);
                    var taxamtItem = 0.00;
                    if (FEAT_SUITETAX == "T" || FEAT_SUITETAX == true) {
                      taxamtItem = transactionRecord.getLineItemValue("item", "taxamount", j);

                    } else {
                      taxamtItem = transactionRecord.getLineItemValue("item", "tax1amt", j);
                    }

                    var netamtItem = round2(parseFloat(grossamtItem) - parseFloat(taxamtItem));

                    var segmentsLine = {};
                    for (var s = 0; s < customSegments.length; s++) {
                      var segmentId = customSegments[s];
                      var segmentValue = transactionRecord.getLineItemValue("item", segmentId, j);
                      if (segmentValue) {
                        segmentsLine[segmentId] = segmentValue;
                      }
                    }


                    if (taxamtItem == 0 && amount_to == 2) {
                      continue;
                    }

                    // Brasil : Calculo del Monto Base
                    if (country.toUpperCase() == 'BRA') {
                      if (taxCalculationForm == 1 || taxCalculationForm == 3) {
                        amount_to = '3'; // Trabaja con el Gross Amount siempre

                        // Si el Flujo 2 para Brasil
                        if (taxCalculationForm == 3) {
                          var oldBaseAmount = transactionRecord.getLineItemValue("item", "custcol_lmry_br_base_amount", j);
                          oldBaseAmount = parseFloat(Math.round(parseFloat(oldBaseAmount) * 100) / 100);
                          var oldTotalImpuestos = transactionRecord.getLineItemValue("item", "custcol_lmry_br_total_impuestos", j);
                          oldTotalImpuestos = parseFloat(Math.round(parseFloat(oldTotalImpuestos) * 100) / 100);
                          var newNetAmount = parseFloat(parseFloat(netamtItem) - parseFloat(oldTotalImpuestos));
                          newNetAmount = parseFloat(Math.round(parseFloat(newNetAmount) * 100) / 100);
                          if (newNetAmount == oldBaseAmount) {
                            grossamtItem = oldBaseAmount;
                            netamtItem = oldBaseAmount;
                          }
                        }

                        var suma = parseFloat(sumaPorcentajes(searchResultCC, '2I', 'custrecord_lmry_ccl_appliesto', 'custrecord_lmry_ar_ccl_taxrate', 'custrecord_lmry_br_ccl_rate_suma', 'custrecord_lmry_br_ccl_catalog', catalogItem, 'custrecord_lmry_sub_type'));
                        // Realiza la formula del Monto Base siguiendo la formula "Monto Base = Monto / (1 - suma de porcentajes)"

                        //Para flujo 0 y si tiene descuento no condicional
                        if (taxCalculationForm == 1) {
                          netamtItem = round2(netamtItem - discountAmt);
                        }

                        grossamtItem = parseFloat(grossamtItem / parseFloat(1 - suma));
                        taxamtItem = parseFloat(taxamtItem / parseFloat(1 - suma));
                        netamtItem = parseFloat(netamtItem / parseFloat(1 - suma));

                        if (is_exclusive == true || is_exclusive == 'T') {
                          var sumaBaseCalculoI = baseCalculoBR(0, j, false);
                          // Realiza la formula del Monto Base para excluyentes siguiendo la formula "Monto Base Excluyentes = Monto Base No Excluyentes - Suma Impuestos No Exluyentes"
                          grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                          netamtItem = parseFloat(netamtItem) - parseFloat(sumaBaseCalculoI);
                          taxamtItem = parseFloat(taxamtItem) - parseFloat(sumaBaseCalculoI);
                        }
                      } else { // Para el Flujo 1 y 3
                        amount_to = '1'; // Trabaja con el Gross Amount siempre
                        if (taxCalculationForm == 4) {

                          grossamtItem = round2(parseFloat(grossamtItem) - discountAmt);

                          if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                            var sumaBaseCalculoI = baseCalculoBR(0, j, false);
                            //si es un impuesto de telecomunicaciones se resta al gross(monto base), la suma de los otros impuestos(PIS, COFINS..)
                            grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                          }
                        }
                      }
                    }

                    // Calculo del Monto Base
                    switch (amount_to) {
                      case '1':
                        baseAmount = parseFloat(grossamtItem) - parseFloat(not_taxable_minimun);
                        break;
                      case '2':
                        baseAmount = parseFloat(taxamtItem) - parseFloat(not_taxable_minimun);
                        break;
                      case '3':
                        baseAmount = parseFloat(netamtItem) - parseFloat(not_taxable_minimun);
                        break;
                    }
                    baseAmount = parseFloat(baseAmount);
                    // Calculo del Monto a Comparar
                    if (amount_to_compare == amount_to) {
                      compareAmount = parseFloat(baseAmount);
                    } else {
                      switch (amount_to_compare) {
                        case '1':
                          compareAmount = parseFloat(grossamtItem);
                          break;
                        case '2':
                          compareAmount = parseFloat(taxamtItem);
                          break;
                        case '3':
                          compareAmount = parseFloat(netamtItem);
                          break;
                      }
                    }

                    if (how_base_amount != null && how_base_amount != '') {
                      switch (how_base_amount) {
                        case '2': // Substrac Minimun
                          baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                          break;
                        case '3': // Minimun
                          baseAmount = parseFloat(min_amount);
                          break;
                        case '4': // Maximun
                          baseAmount = parseFloat(max_amount);
                          break;

                      }
                    }

                    if (taxCalculationForm == 4 && (isHybrid == true || isHybrid == "T") && isHybridTax) {
                      baseAmount = baseAmount * hybridPercent;
                    }

                    baseAmount = parseFloat(baseAmount);
                    if (baseAmount <= 0) {
                      continue;
                    }

                    // Calculo de retencion
                    if (max_amount != 0) {
                      if (min_amount <= parseFloat(compareAmount) && parseFloat(compareAmount) <= max_amount) {
                        retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                      }
                    } else {
                      if (min_amount <= parseFloat(compareAmount)) {
                        retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                      }
                    }

                    //nlapiLogExecution("ERROR", "CC - Retencion", j + ' - ' + retencion);
                    if (parseFloat(retencion) > 0 || round2(parseFloat(retencion)) > 0) {
                      var retencionAuxRound = round2(parseFloat(retencion));
                      retencion = round(retencion, 7);
                      if (featureMB) {
                        retencionAuxRound = tipoCambioMB(transactionRecord, book, retencionAuxRound, rounding);
                      }
                      if (parseFloat(retencionAuxRound) > 0) {
                        var telecommTaxesFlows = [1, 3, 4]; //Flujos con impuestos de telecomunicaciones (FUST y FUNTEL)
                        // Para Brasil se consideran los impuestos de telecomunicacion (campo is_exclusive) solo para el Flujo 0, 2 y 3
                        if ((is_exclusive != true && is_exclusive != 'T') && telecommTaxesFlows.indexOf(Number(taxCalculationForm) != -1)) {
                          baseCalculoBR(parseFloat(retencion), j, true);
                          //nlapiLogExecution("ERROR", subtype + " CC retencionAuxRoundBR true",retencionAuxRoundBR);
                        }

                        if (genera == '1') { // Si genera Journal sale del proceso
                          continue;
                        }

                        var arreglo_DetailsItem = new Array();
                        arreglo_DetailsItem.push('I');
                        arreglo_DetailsItem.push(idsubtype);
                        arreglo_DetailsItem.push(subtype);

                        if (clasificacionCC == true || clasificacionCC == 'T') { // Segmentacion de la CC
                          arreglo_DetailsItem.push(elegirSegmentacion(prefDep, department, transactionRecord.getLineItemValue("item", "department", j), depSetup, transactionRecord.getFieldValue("department")));
                          arreglo_DetailsItem.push(elegirSegmentacion(prefClas, class_, transactionRecord.getLineItemValue("item", "class", j), classSetup, transactionRecord.getFieldValue("class")));
                          arreglo_DetailsItem.push(elegirSegmentacion(prefLoc, location, transactionRecord.getLineItemValue("item", "location", j), locSetup, transactionRecord.getFieldValue("location")));
                        } else { // Segmentacion del Item
                          arreglo_DetailsItem.push(elegirSegmentacion(prefDep, transactionRecord.getLineItemValue("item", "department", j), department, depSetup, ''));
                          arreglo_DetailsItem.push(elegirSegmentacion(prefClas, transactionRecord.getLineItemValue("item", "class", j), class_, classSetup, ''));
                          arreglo_DetailsItem.push(elegirSegmentacion(prefLoc, transactionRecord.getLineItemValue("item", "location", j), location, locSetup, ''));
                        }

                        if (accountCC == false || accountCC == 'F') { // Cuentas del Item y Transaccion
                          if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 10 || filtroTransactionType == 7) { // Invoice - Sales Order - Estimate - Bill Credit
                            arreglo_DetailsItem.push(parseFloat(taxItemCuenta)); // Debito - Cuenta del Item
                            arreglo_DetailsItem.push(parseFloat(transactionRecord.getFieldValue("account"))); // Credito - Cuenta de la transaccion
                          }
                          if (filtroTransactionType == 4) { // Bill
                            arreglo_DetailsItem.push(parseFloat(transactionRecord.getFieldValue("account"))); // Debito - Cuenta de la transaccion
                            arreglo_DetailsItem.push(parseFloat(taxItemCuenta)); // Credito - Cuenta del Item
                          }
                          if (filtroTransactionType == 8) { // Credit Memo
                            if (reverse == 1) {
                              arreglo_DetailsItem.push(parseFloat(taxItemCuenta)); // Credito - Cuenta del Item
                              arreglo_DetailsItem.push(parseFloat(transactionRecord.getFieldValue("account"))); // Debito - Cuenta de la transaccion
                            } else {
                              arreglo_DetailsItem.push(parseFloat(transactionRecord.getFieldValue("account"))); // Debito - Cuenta de la transaccion
                              arreglo_DetailsItem.push(parseFloat(taxItemCuenta)); // Credito - Cuenta del Item
                            }
                          }
                        } else { // Cuentas de la CC
                          if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 10 || filtroTransactionType == 4) { // Invoice - Sales Order - Estimate - Bill
                            arreglo_DetailsItem.push(parseFloat(account1)); // Cuenta Debito - CC
                            arreglo_DetailsItem.push(parseFloat(account2)); // Cuenta Credito - CC
                          }
                          if (filtroTransactionType == 7) { // Bill Credit
                            arreglo_DetailsItem.push(parseFloat(account2)); // Cuenta Debito - CC
                            arreglo_DetailsItem.push(parseFloat(account1)); // Cuenta Credito - CC
                          }
                          if (filtroTransactionType == 8) { // Credit Memo
                            if (reverse == 1) {
                              arreglo_DetailsItem.push(parseFloat(account1)); // Cuenta Debito - CC
                              arreglo_DetailsItem.push(parseFloat(account2)); // Cuenta Credito - CC
                            } else {
                              arreglo_DetailsItem.push(parseFloat(account2)); // Cuenta Debito - CC
                              arreglo_DetailsItem.push(parseFloat(account1)); // Cuenta Credito - CC
                            }
                          }
                        }

                        arreglo_DetailsItem.push(catalogItem);
                        arreglo_DetailsItem.push(retencionAuxRound);
                        arreglo_DetailsItem.push(' (LatamTax - Contributory Class) - (ID Item: ' + idItem + ')');

                        for (var s = 0; s < customSegments.length; s++) {
                          var segmentId = customSegments[s];
                          var segmentValue = segmentsCC[segmentId] || segmentsLine[segmentId] || "";
                          arreglo_DetailsItem.push(Number(segmentValue));
                        }

                        if (summary == 'F' || summary == false) {
                          agregarLineas(customLines, book, arreglo_DetailsItem, 0, false, prefDepLine, prefClassLine);
                        } else {
                          arreglo_Items.push(arreglo_DetailsItem);
                        }
                      }
                    } // Fin Retencion > 0
                  } // Fin FlagItem = true
                } // Fin For de Items
              } // Fin Caso 2I : Entidad - Items
            } // Fin Caso 2I / 2E : Entidad - Items / Expenses
          } // Fin for CC
        } // Fin if CC != null

        /********************************************
         * Consulta de Impuestos Exentos para Brasil
         *******************************************/
        var filtroExemptBR = '';
        if (country.toUpperCase() == 'BRA') {
          filtroExemptBR = exemptTaxBR(entity);
        }

        // Inicializa las variables para Brasil
        sumaBaseCalculoT = 0;
        sumaBaseCalculoI = 0;
        blnBaseCalculoI = false;
        arreglo_SumaBaseBR = new Array();
        arreglo_IndiceBaseBR = new Array();
        var m = 8;

        /****************************************************
         * Busqueda en el record: LatamReady - National Taxes
         ****************************************************/
        // Filtros
        var filtrosNT = [
          ["isinactive", "is", "F"], "AND",
          ["custrecord_lmry_ntax_datefrom", "onorbefore", fecha], "AND",
          ["custrecord_lmry_ntax_dateto", "onorafter", fecha], "AND",
          ["custrecord_lmry_ntax_transactiontypes", "anyof", filtroTransactionType], "AND",
          ["custrecord_lmry_ntax_taxtype", "anyof", "4"], "AND",
          ["custrecord_lmry_ntax_appliesto", "anyof", "2"], "AND",
          ["custrecord_lmry_ntax_gen_transaction", "anyof", "2"]
        ];

        var documents = ['@NONE@'];
        if (documentType) {
          documents.push(documentType);
        }

        filtrosNT.push("AND", ["custrecord_lmry_ntax_fiscal_doctype", "anyof", documents]);

        if (filterLoc == 'T' || filterLoc == true) {
          filtrosNT.push("AND", ["custrecord_lmry_ntax_location", "anyof", locationTransaction]);
        }

        if (featureSubs == 'T' || featureSubs == true) {
          filtrosNT.push("AND", ["custrecord_lmry_ntax_subsidiary", "anyof", subsidiary])
        }

        if (filtroExemptBR) {
          filtrosNT.push("AND", ["custrecord_lmry_ntax_sub_type", "noneof", filtroExemptBR])
        }

        if (accountCC == 'T' || accountCC == true) {
          filtrosNT.push("AND", ["custrecord_lmry_ntax_debit_account", "noneof", "@NONE@"],
            "AND", ["custrecord_lmry_ntax_credit_account", "noneof", "@NONE@"])
        }

        var provinces = ['@NONE@'];
        if (province) {
          provinces.push(province);
        }

        var cities = ['@NONE@'];
        if (city) {
          cities.push(city)
        }

        var districts = ['@NONE@'];
        if (district) {
          districts.push(district);
        }

        filtrosNT.push('AND', [
          [
            ["custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location", "is", "F"]
          ]
          , "OR", [
            ["custrecord_lmry_ntax_sub_type.custrecord_lmry_tax_by_location", "is", "T"],
            "AND", ["custrecord_lmry_ntax_province", "anyof", provinces],
            "AND", ["custrecord_lmry_ntax_city", "anyof", cities],
            "AND", ["custrecord_lmry_ntax_district", "anyof", districts]
          ]
        ]);

        var catalogFilters = getCatalogFilters(transactionRecord, taxCalculationForm, "custrecord_lmry_ntax_catalog", "custrecord_lmry_nt_nfce_catalog_id");
        nlapiLogExecution("DEBUG", "catalogFilters", JSON.stringify(catalogFilters));
        if (catalogFilters.length) {
          filtrosNT.push("AND", catalogFilters);
        }

        if (taxCalculationForm != 4 || !isHybrid) {
          filtrosNT.push("AND", ["custrecord_lmry_nt_is_hybrid", "is", "F"]);
        }

        // Columnas
        var columnas = new Array();
        columnas[0] = new nlobjSearchColumn("custrecord_lmry_ntax_appliesto").setSort(false);
        columnas[1] = new nlobjSearchColumn("custrecord_lmry_ntax_catalog").setSort(false);
        columnas[2] = new nlobjSearchColumn("custrecord_lmry_br_ntax_exclusive").setSort(false);
        columnas[3] = new nlobjSearchColumn("custrecord_lmry_ntax_taxrate");
        columnas[4] = new nlobjSearchColumn("custrecord_lmry_ntax_amount");
        columnas[5] = new nlobjSearchColumn("custrecord_lmry_ntax_sub_type");
        columnas[6] = new nlobjSearchColumn("custrecord_lmry_ntax_minamount");
        columnas[7] = new nlobjSearchColumn("custrecord_lmry_ntax_debit_account");
        columnas[8] = new nlobjSearchColumn("custrecord_lmry_ntax_credit_account");
        columnas[9] = new nlobjSearchColumn("custrecord_lmry_ntax_applies_to_item");
        columnas[10] = new nlobjSearchColumn("custrecord_lmry_ntax_applies_to_account");
        columnas[11] = new nlobjSearchColumn("custrecord_lmry_ntax_department");
        columnas[12] = new nlobjSearchColumn("custrecord_lmry_ntax_class");
        columnas[13] = new nlobjSearchColumn("custrecord_lmry_ntax_location");
        columnas[14] = new nlobjSearchColumn("custrecord_lmry_ntax_addratio");
        columnas[15] = new nlobjSearchColumn("custrecord_lmry_ec_ntax_catalog");
        columnas[16] = new nlobjSearchColumn("custrecord_lmry_ntax_maxamount");
        columnas[17] = new nlobjSearchColumn("custrecord_lmry_ntax_accandmin_with");
        columnas[18] = new nlobjSearchColumn("custrecord_lmry_ntax_not_taxable_minimum");
        columnas[19] = new nlobjSearchColumn("custrecord_lmry_ntax_base_amount");
        columnas[20] = new nlobjSearchColumn("custrecord_lmry_ntax_set_baseretention");
        columnas[21] = new nlobjSearchColumn("custrecord_lmry_ntax_gen_transaction");
        columnas[22] = new nlobjSearchColumn("custrecord_lmry_br_ntax_rate_suma");
        if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 8 || filtroTransactionType == 10) {
          columnas[23] = new nlobjSearchColumn('incomeaccount', "custrecord_lmry_ntax_taxitem");
        } else {
          columnas[23] = new nlobjSearchColumn('expenseaccount', "custrecord_lmry_ntax_taxitem");
        }

        columnas[24] = new nlobjSearchColumn("custrecord_lmry_tax_by_location", "custrecord_lmry_ntax_sub_type");
        columnas[25] = new nlobjSearchColumn("custrecord_lmry_ntax_config_segment");
        columnas[26] = new nlobjSearchColumn("custrecord_lmry_is_tax_not_included", "custrecord_lmry_ntax_sub_type");
        columnas[27] = new nlobjSearchColumn("custrecord_lmry_nt_is_substitution");
        columnas[28] = new nlobjSearchColumn("custrecord_lmry_nt_nfce_catalog_id");
        columnas[29] = new nlobjSearchColumn("custrecord_lmry_nt_is_hybrid");
        columnas[30] = new nlobjSearchColumn("custrecord_lmry_nt_hybrid_part");

        var searchNT = nlapiCreateSearch("customrecord_lmry_national_taxes", filtrosNT, columnas);
        var searchResultNT = searchNT.runSearch().getResults(0, 1000);

        //nlapiLogExecution("ERROR", "Cantidad de ntax", searchResultNT.length);

        if (searchResultNT != null && searchResultNT.length > 0) {

          // Brasil : Calculo del Monto Base para el Flujo 0 y 2
          if (country.toUpperCase() == 'BRA' && (taxCalculationForm == 1 || taxCalculationForm == 3)) {
            var suma = parseFloat(sumaPorcentajes(searchResultNT, '1', 'custrecord_lmry_ntax_appliesto', 'custrecord_lmry_ntax_taxrate', 'custrecord_lmry_br_ntax_rate_suma', '', '', 'custrecord_lmry_ntax_sub_type'));
            grossamt = parseFloat(grossamtInicial / parseFloat(1 - suma));
            netamt = parseFloat(netamtInicial / parseFloat(1 - suma));
            taxamt = parseFloat(taxamtInicial / parseFloat(1 - suma));
          }

          for (var i = 0; i < searchResultNT.length; i++) {

            var colColums = searchResultNT[i].getAllColumns();
            var taxrate = searchResultNT[i].getValue("custrecord_lmry_ntax_taxrate");
            var amount_to = searchResultNT[i].getValue("custrecord_lmry_ntax_amount");
            var applies_to = searchResultNT[i].getValue("custrecord_lmry_ntax_appliesto");
            var subtype = searchResultNT[i].getText("custrecord_lmry_ntax_sub_type");
            var idsubtype = searchResultNT[i].getValue("custrecord_lmry_ntax_sub_type");
            var min_amount = searchResultNT[i].getValue("custrecord_lmry_ntax_minamount");
            var account1 = searchResultNT[i].getValue("custrecord_lmry_ntax_debit_account");
            var account2 = searchResultNT[i].getValue("custrecord_lmry_ntax_credit_account");
            var applies_item = searchResultNT[i].getValue("custrecord_lmry_ntax_applies_to_item");
            var applies_account = searchResultNT[i].getValue("custrecord_lmry_ntax_applies_to_account");
            var department = searchResultNT[i].getValue("custrecord_lmry_ntax_department");
            var class_ = searchResultNT[i].getValue("custrecord_lmry_ntax_class");
            var location = searchResultNT[i].getValue("custrecord_lmry_ntax_location");
            var catalog_br = searchResultNT[i].getValue("custrecord_lmry_ntax_catalog");
            var ratio = searchResultNT[i].getValue("custrecord_lmry_ntax_addratio");
            var catalog_ec = searchResultNT[i].getValue("custrecord_lmry_ec_ntax_catalog");
            var max_amount = searchResultNT[i].getValue("custrecord_lmry_ntax_maxamount");
            var amount_to_compare = searchResultNT[i].getValue("custrecord_lmry_ntax_accandmin_with");
            var not_taxable_minimun = searchResultNT[i].getValue("custrecord_lmry_ntax_not_taxable_minimum");
            var how_base_amount = searchResultNT[i].getValue("custrecord_lmry_ntax_base_amount");
            var base_retention = searchResultNT[i].getValue("custrecord_lmry_ntax_set_baseretention");
            var genera = searchResultNT[i].getValue("custrecord_lmry_ntax_gen_transaction");
            var is_exclusive = searchResultNT[i].getValue("custrecord_lmry_br_ntax_exclusive");
            var isTaxByLocation = searchResultNT[i].getValue("custrecord_lmry_tax_by_location", "custrecord_lmry_ntax_sub_type")
            var isTaxNotIncluded = searchResultNT[i].getValue("custrecord_lmry_is_tax_not_included", "custrecord_lmry_ntax_sub_type");
            var isSubstitutionTax = searchResultNT[i].getValue("custrecord_lmry_nt_is_substitution");
            var nfceCatalog = searchResultNT[i].getValue("custrecord_lmry_nt_nfce_catalog_id") || "";
            nfceCatalog = Number(nfceCatalog);
            var isHybridTax = searchResultNT[i].getValue("custrecord_lmry_nt_is_hybrid");
            isHybridTax = (isHybridTax == true || isHybridTax == "T");
            var hybridPercent = searchResultNT[i].getValue("custrecord_lmry_nt_hybrid_part");
            hybridPercent = parseFloat(hybridPercent) || 1;

            if (Number(taxCalculationForm) != 4) {
              isTaxNotIncluded = false;
              isSubstitutionTax = false
            }

            var taxItemCuenta = '';
            if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 8 || filtroTransactionType == 10) {
              taxItemCuenta = searchResultNT[i].getValue(colColums[23]);
            } else {
              taxItemCuenta = searchResultNT[i].getValue(colColums[23]);
            }

            var segmentsNT = searchResultNT[i].getValue("custrecord_lmry_ntax_config_segment");
            if (segmentsNT) {
              segmentsNT = JSON.parse(segmentsNT);
            }

            retencion = 0;
            baseAmount = 0;
            compareAmount = 0;

            // Conversion de los montos de la CC a moneda de la transaccion
            if (min_amount == null || min_amount == '') { // Subsidiaria - Totales - Minimo
              min_amount = 0;
            }
            min_amount = parseFloat(parseFloat(min_amount) / exchangeRate);
            if (max_amount == null || max_amount == '') { // Subsidiaria - Totales / Items - Maximo
              max_amount = 0;
            }
            max_amount = parseFloat(parseFloat(max_amount) / exchangeRate);
            if (base_retention == null || base_retention == '') {
              base_retention = 0;
            }
            base_retention = parseFloat(parseFloat(base_retention) / exchangeRate);
            if (not_taxable_minimun == null || not_taxable_minimun == '') {
              not_taxable_minimun = 0;
            }
            not_taxable_minimun = parseFloat(parseFloat(not_taxable_minimun) / exchangeRate);
            if (ratio == null || ratio == '') {
              ratio = 1;
            }
            if (amount_to_compare == '' || amount_to_compare == null) {
              amount_to_compare = amount_to;
            }

            if ((applyWHT == true || applyWHT == 'T') && (isTaxByLocation == true || isTaxByLocation == 'T')) {
              continue;
            }

            if ((isTaxNotIncluded == "T" || isTaxNotIncluded == true) || (isSubstitutionTax == "T" || isSubstitutionTax == true)) {
              continue;
            }

            // Caso 3 : Subsidiaria - Totales
            if (applies_to == 1) {

              if (genera == '1') { // Si genera Journal sale del proceso
                continue;
              }

              if (country.toUpperCase() == 'BRA') {
                if (taxCalculationForm == 1 || taxCalculationForm == 3) { // Flujo 0 y 2
                  amount_to = '3'; // Trabaja con el Gross Amount siempre
                  if ((is_exclusive == true || is_exclusive == 'T') && sumaBaseCalculoT > 0) {
                    grossamt = parseFloat(grossamt) - parseFloat(sumaBaseCalculoT);
                    netamt = parseFloat(netamt) - parseFloat(sumaBaseCalculoT);
                    taxamt = parseFloat(taxamt) - parseFloat(sumaBaseCalculoT);
                    sumaBaseCalculoT = 0;
                  }
                } else {
                  amount_to = '1'; // Trabaja con el Gross Amount siempre
                  if (taxCalculationForm == 4) {
                    if ((is_exclusive == true || is_exclusive == 'T') && sumaBaseCalculoT > 0) {
                      grossamt = parseFloat(grossamt) - parseFloat(sumaBaseCalculoT);
                      sumaBaseCalculoT = 0;
                    }
                  }
                }
              }

              if (taxamt == 0 && amount_to == 2) {
                continue;
              }
              // Calculo del Monto Base
              switch (amount_to) {
                case '1':
                  baseAmount = parseFloat(grossamt) - parseFloat(not_taxable_minimun);
                  break;
                case '2':
                  baseAmount = parseFloat(taxamt) - parseFloat(not_taxable_minimun);
                  break;
                case '3':
                  baseAmount = parseFloat(netamt) - parseFloat(not_taxable_minimun);
                  break;
              }
              baseAmount = parseFloat(baseAmount);
              // Calculo del Monto a Comparar
              if (amount_to_compare == amount_to) {
                compareAmount = parseFloat(baseAmount);
              } else {
                switch (amount_to_compare) {
                  case '1':
                    compareAmount = parseFloat(grossamt);
                    break;
                  case '2':
                    compareAmount = parseFloat(taxamt);
                    break;
                  case '3':
                    compareAmount = parseFloat(netamt);
                    break;
                }
              }

              if (how_base_amount != null && how_base_amount != '') {
                switch (how_base_amount) {
                  case '2': // Substrac Minimun
                    baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                    break;
                  case '3': // Minimun
                    baseAmount = parseFloat(min_amount);
                    break;
                  case '4': // Maximun
                    baseAmount = parseFloat(max_amount);
                    break;

                }
              }
              baseAmount = parseFloat(baseAmount);
              if (baseAmount <= 0) {
                continue;
              }

              // Calculo de retencion
              if (max_amount != 0) {
                if (min_amount <= parseFloat(compareAmount) && parseFloat(compareAmount) <= max_amount) {
                  retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                }
              } else {
                if (min_amount <= parseFloat(compareAmount)) {
                  retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                }
              }

              //nlapiLogExecution('ERROR', 'Retencion NT', parseFloat(retencion));
              if (parseFloat(retencion) > 0 || round2(parseFloat(retencion)) > 0) {
                var retencionAuxRound = round2(retencion);
                retencion = round(retencion, 7);
                if (featureMB) {
                  retencionAuxRound = tipoCambioMB(transactionRecord, book, retencionAuxRound, rounding);
                }
                if (parseFloat(retencionAuxRound) > 0) {
                  //nlapiLogExecution("ERROR", 'retencionAuxRound - decimal', retencionAuxRound + ' - ' + decimal);
                  var telecommTaxesFlows = [1, 3, 4]; //Flujos con impuestos de telecomunicaciones (FUST y FUNTEL)
                  if (country.toUpperCase() == 'BRA' && (is_exclusive != true && is_exclusive != 'T') && telecommTaxesFlows.indexOf(Number(taxCalculationForm)) != -1) {
                    sumaBaseCalculoT = sumaBaseCalculoT + parseFloat(retencion);
                  }

                  var cuentaDebit_Total = '';
                  var cuentaCredit_Total = '';

                  if (accountCC == false || accountCC == 'F') { // Cuentas del Item y Transaccion
                    if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 10 || filtroTransactionType == 7) { // Invoice - Sales Order - Estimate - Bill Credit
                      cuentaDebit_Total = parseFloat(taxItemCuenta); // Debito - Cuenta del Item
                      cuentaCredit_Total = parseFloat(transactionRecord.getFieldValue("account")); // Credito - Cuenta de la transaccion
                    }
                    if (filtroTransactionType == 4) { // Bill
                      cuentaDebit_Total = parseFloat(transactionRecord.getFieldValue("account")); // Debito - Cuenta de la transaccion
                      cuentaCredit_Total = parseFloat(taxItemCuenta); // Credito - Cuenta del Item
                    }
                    if (filtroTransactionType == 8) { // Credit Memo
                      if (reverse == 1) {
                        cuentaDebit_Total = parseFloat(taxItemCuenta); // Debito - Cuenta del Item
                        cuentaCredit_Total = parseFloat(transactionRecord.getFieldValue("account")); // Credito - Cuenta de la transaccion
                      } else {
                        cuentaDebit_Total = parseFloat(transactionRecord.getFieldValue("account")); // Debito - Cuenta de la transaccion
                        cuentaCredit_Total = parseFloat(taxItemCuenta); // Credito - Cuenta del Item
                      }
                    }
                  } else { // Cuentas del NT
                    if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 10 || filtroTransactionType == 4) { // Invoice - Sales Order - Estimate - Bill
                      var cuentaDebit_Total = parseFloat(account1); // Cuenta Debito - CC
                      var cuentaCredit_Total = parseFloat(account2); // Cuenta Credito - CC
                    }
                    if (filtroTransactionType == 7) { // Bill Credit
                      var cuentaDebit_Total = parseFloat(account2); // Cuenta Credito - CC
                      var cuentaCredit_Total = parseFloat(account1); // Cuenta Debito - CC
                    }
                    if (filtroTransactionType == 8) { // Credit Memo
                      if (reverse == 1) {
                        var cuentaDebit_Total = parseFloat(account1); // Cuenta Debito - CC
                        var cuentaCredit_Total = parseFloat(account2); // Cuenta Credito - CC
                      } else {
                        var cuentaDebit_Total = parseFloat(account2); // Cuenta Credito - CC
                        var cuentaCredit_Total = parseFloat(account1); // Cuenta Debito - CC
                      }
                    }
                  }

                  if (clasificacionCC == true || clasificacionCC == 'T') { // Segmentacion de la Clase Contributiva
                    var dep1 = elegirSegmentacion(prefDep, department, transactionRecord.getFieldValue("department"), depSetup, transactionRecord.getFieldValue("department"));
                    var cla1 = elegirSegmentacion(prefClas, class_, transactionRecord.getFieldValue("class"), classSetup, transactionRecord.getFieldValue("class"));
                    var loc1 = elegirSegmentacion(prefLoc, location, transactionRecord.getFieldValue("location"), locSetup, transactionRecord.getFieldValue("location"));
                  } else { // Segmentacion de la Transaccion
                    var dep1 = elegirSegmentacion(prefDep, transactionRecord.getFieldValue("department"), department, depSetup, '');
                    var cla1 = elegirSegmentacion(prefClas, transactionRecord.getFieldValue("class"), class_, classSetup, '');
                    var loc1 = elegirSegmentacion(prefLoc, transactionRecord.getFieldValue("location"), location, locSetup, '');
                  }

                  // Cuenta dependiendo del Libro Contable
                  if (!book.isPrimary()) {
                    cuentaDebit_Total = getAccount(cuentaDebit_Total, dep1, cla1, loc1);
                    cuentaCredit_Total = getAccount(cuentaCredit_Total, dep1, cla1, loc1);
                  }

                  var newLineDebit = customLines.addNewLine();
                  newLineDebit.setDebitAmount(retencionAuxRound);
                  newLineDebit.setAccountId(parseFloat(cuentaDebit_Total));
                  newLineDebit.setMemo(subtype + ' (LatamTax - National Taxes)');
                  if (dep1 != '' && dep1 != null && dep1 != 0 && (prefDepLine == true || prefDepLine == 'T')) {
                    newLineDebit.setDepartmentId(parseInt(dep1));
                  }
                  if (cla1 != '' && cla1 != null && cla1 != 0 && (prefClassLine == true || prefClassLine == 'T')) {
                    newLineDebit.setClassId(parseInt(cla1));
                  }
                  if (loc1 != '' && loc1 != null && loc1 != 0) {
                    newLineDebit.setLocationId(parseInt(loc1));
                  }

                  if (customSegments.length) {
                    for (var s = 0; s < customSegments.length; s++) {
                      var segmentId = customSegments[s];
                      var segmentValue = segmentsNT[segmentId] || transactionSegments[segmentId] || "";

                      if (segmentValue) {
                        newLineDebit.setSegmentValueId(segmentId, parseInt(segmentValue));
                      }
                    }
                  }

                  newLineDebit.setEntityId(parseInt(entity));

                  var newLineCredit = customLines.addNewLine();
                  newLineCredit.setCreditAmount(retencionAuxRound);
                  newLineCredit.setAccountId(parseFloat(cuentaCredit_Total));
                  newLineCredit.setMemo(subtype + ' (LatamTax - National Taxes)');
                  if (dep1 != '' && dep1 != null && dep1 != 0 && (prefDepLine == true || prefDepLine == 'T')) {
                    newLineCredit.setDepartmentId(parseInt(dep1));
                  }
                  if (cla1 != '' && cla1 != null && cla1 != 0 && (prefClassLine == true || prefClassLine == 'T')) {
                    newLineCredit.setClassId(parseInt(cla1));
                  }
                  if (loc1 != '' && loc1 != null && loc1 != 0) {
                    newLineCredit.setLocationId(parseInt(loc1));
                  }

                  if (customSegments.length) {
                    for (var s = 0; s < customSegments.length; s++) {
                      var segmentId = customSegments[s];
                      var segmentValue = segmentsNT[segmentId] || transactionSegments[segmentId] || "";

                      if (segmentValue) {
                        newLineCredit.setSegmentValueId(segmentId, parseInt(segmentValue));
                      }
                    }
                  }

                  newLineCredit.setEntityId(parseInt(entity));
                }
              } // Fin retencion > 0
            } // Fin Caso 3 : Subsidiaria - Totales

            // Caso 4I / 4E : Subsidiaria - Items / Expenses
            else {
              //nlapiLogExecution("ERROR", 'item', applies_item);
              //nlapiLogExecution("ERROR", 'expense', applies_account);

              // Caso 4I : Subsidiaria - Items
              if (catalog_br || nfceCatalog || applies_item) {
                for (var j = 1; j <= cantidad_items; j++) {
                  var idItem = transactionRecord.getLineItemValue("item", "item", j);

                  var typeDiscount = transactionRecord.getLineItemValue("item", "custcol_lmry_col_sales_type_discount", j);

                  var discountAmt = discountAmounts[String(j)] || 0.00;
                  var flagItem = false;
                  //Solo considera descuentos para los flujos 0 y 3 y para Descuento no condicional
                  if ([1, 4].indexOf(Number(taxCalculationForm)) == -1) {
                    discountAmt = 0;
                  }

                  if (typeDiscount) {
                    continue;
                  }

                  var catalogItem = transactionRecord.getLineItemValue('item', 'custcol_lmry_br_service_catalog', j) || "";

                  if (catalogItem && (catalogItem == catalog_br)) {
                    flagItem = true;
                  }

                  if (!flagItem && idItem && (idItem == applies_item)) {
                    flagItem = true;
                  }

                  var nfceCatalogLine = transactionRecord.getLineItemValue("item", "custcol_lmry_br_nfce_catalog", j) || "";
                  nfceCatalogLine = Number(nfceCatalogLine);

                  nlapiLogExecution("DEBUG", "catalogItem,idItem,nfceCatalogLine", [catalogItem, idItem, nfceCatalogLine].join("-"));

                  if (isHybrid) {
                    if (!flagItem && nfceCatalogLine && (nfceCatalog == nfceCatalogLine)) {
                      flagItem = true;
                    }

                    var isHybridLine = false;
                    if (nfceCatalogLine && catalogItem) { //Si tiene ambos catalogos
                      isHybridLine = true;
                    }

                    if ((isHybridTax && !isHybridLine) || (!isHybridTax && isHybridLine)) {
                      continue;
                    }
                  }

                  var isTaxItem = transactionRecord.getLineItemValue("item", "custcol_lmry_ar_item_tributo", j);

                  if (isTaxItem == "T" || isTaxItem == true) {
                    continue;
                  }

                  retencion = 0;
                  if (flagItem == true) {

                    var grossamtItem = transactionRecord.getLineItemValue("item", "grossamt", j);
                    var taxamtItem = 0.00;
                    if (FEAT_SUITETAX == "T" || FEAT_SUITETAX == true) {
                      taxamtItem = transactionRecord.getLineItemValue("item", "taxamount", j);

                    } else {
                      taxamtItem = transactionRecord.getLineItemValue("item", "tax1amt", j);
                    }
                    var netamtItem = round2(parseFloat(grossamtItem) - parseFloat(taxamtItem));

                    var segmentsLine = {};
                    for (var s = 0; s < customSegments.length; s++) {
                      var segmentId = customSegments[s];
                      var segmentValue = transactionRecord.getLineItemValue("item", segmentId, j);
                      if (segmentValue) {
                        segmentsLine[segmentId] = segmentValue;
                      }
                    }

                    if (taxamtItem == 0 && amount_to == 2) {
                      continue;
                    }

                    // Brasil : Calculo del Monto Base
                    if (country.toUpperCase() == 'BRA') {
                      if (taxCalculationForm == 1 || taxCalculationForm == 3) {

                        amount_to = '3'; // Trabaja con el Gross Amount siempre

                        // Si el Flujo 2 para Brasil
                        if (taxCalculationForm == 3) {
                          var oldBaseAmount = transactionRecord.getLineItemValue("item", "custcol_lmry_br_base_amount", j);
                          oldBaseAmount = parseFloat(Math.round(parseFloat(oldBaseAmount) * 100) / 100);
                          var oldTotalImpuestos = transactionRecord.getLineItemValue("item", "custcol_lmry_br_total_impuestos", j);
                          oldTotalImpuestos = parseFloat(Math.round(parseFloat(oldTotalImpuestos) * 100) / 100);
                          var newNetAmount = parseFloat(parseFloat(netamtItem) - parseFloat(oldTotalImpuestos));
                          newNetAmount = parseFloat(Math.round(parseFloat(newNetAmount) * 100) / 100);
                          if (newNetAmount == oldBaseAmount) {
                            grossamtItem = oldBaseAmount;
                            netamtItem = oldBaseAmount;
                          }
                        }

                        var suma = parseFloat(sumaPorcentajes(searchResultNT, '2I', 'custrecord_lmry_ntax_appliesto', 'custrecord_lmry_ntax_taxrate', 'custrecord_lmry_br_ntax_rate_suma', 'custrecord_lmry_ntax_catalog', catalogItem, 'custrecord_lmry_ntax_sub_type'));
                        // Realiza la formula del Monto Base siguiendo la formula "Monto Base = Monto / (1 - suma de porcentajes)"

                        //Para flujo 0 y si tiene descuento no condicional
                        if (taxCalculationForm == 1) {
                          netamtItem = round2(netamtItem - discountAmt);
                        }

                        grossamtItem = parseFloat(grossamtItem / parseFloat(1 - suma));
                        taxamtItem = parseFloat(taxamtItem / parseFloat(1 - suma));
                        netamtItem = parseFloat(netamtItem / parseFloat(1 - suma));

                        if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                          var sumaBaseCalculoI = baseCalculoBR(0, j, false);
                          // Realiza la formula del Monto Base para excluyentes siguiendo la formula "Monto Base Excluyentes = Monto Base No Excluyentes - Suma Impuestos No Exluyentes"
                          grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                          netamtItem = parseFloat(netamtItem) - parseFloat(sumaBaseCalculoI);
                          taxamtItem = parseFloat(taxamtItem) - parseFloat(sumaBaseCalculoI);
                          blnBaseCalculoI = true;
                        }
                      } else { // Para el Flujo 1 y 3
                        amount_to = '1'; // Trabaja con el Gross Amount siempre
                        if (taxCalculationForm == 4) {
                          grossamtItem = round2(parseFloat(grossamtItem) - discountAmt);

                          if (is_exclusive == true || is_exclusive == 'T') { // Si es un impuesto de telecomunicacion (FUST o FUNTTEL)
                            var sumaBaseCalculoI = baseCalculoBR(0, j, false);
                            //si es un impuesto de telecomunicaciones se resta al gross(monto base), la suma de los otros impuestos(PIS, COFINS..)
                            grossamtItem = parseFloat(grossamtItem) - parseFloat(sumaBaseCalculoI);
                          }
                        }
                      }
                    }

                    // Calculo del Monto Base
                    switch (amount_to) {
                      case '1':
                        baseAmount = parseFloat(grossamtItem) - parseFloat(not_taxable_minimun);
                        break;
                      case '2':
                        baseAmount = parseFloat(taxamtItem) - parseFloat(not_taxable_minimun);
                        break;
                      case '3':
                        baseAmount = parseFloat(netamtItem) - parseFloat(not_taxable_minimun);
                        break;
                    }
                    baseAmount = parseFloat(baseAmount);
                    // Calculo del Monto a Comparar
                    if (amount_to_compare == amount_to) {
                      compareAmount = parseFloat(baseAmount);
                    } else {
                      switch (amount_to_compare) {
                        case '1':
                          compareAmount = parseFloat(grossamtItem);
                          break;
                        case '2':
                          compareAmount = parseFloat(taxamtItem);
                          break;
                        case '3':
                          compareAmount = parseFloat(netamtItem);
                          break;
                      }
                    }

                    if (how_base_amount != null && how_base_amount != '') {
                      switch (how_base_amount) {
                        case '2': // Substrac Minimun
                          baseAmount = parseFloat(baseAmount) - parseFloat(min_amount);
                          break;
                        case '3': // Minimun
                          baseAmount = parseFloat(min_amount);
                          break;
                        case '4': // Maximun
                          baseAmount = parseFloat(max_amount);
                          break;

                      }
                    }

                    if (taxCalculationForm == 4 && (isHybrid == true || isHybrid == "T") && isHybridTax) {
                      baseAmount = baseAmount * hybridPercent;
                    }

                    baseAmount = parseFloat(baseAmount);
                    if (baseAmount <= 0) {
                      continue;
                    }

                    // Calculo de retencion
                    if (max_amount != 0) {
                      if (min_amount <= parseFloat(compareAmount) && parseFloat(compareAmount) <= max_amount) {
                        retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                      }
                    } else {
                      if (min_amount <= parseFloat(compareAmount)) {
                        retencion = (parseFloat(taxrate) * parseFloat(baseAmount) * parseFloat(ratio)) + parseFloat(base_retention);
                      }
                    }

                    //nlapiLogExecution("ERROR", "CC - Retencion", j + ' - ' + retencion);
                    if (parseFloat(retencion) > 0 || round2(parseFloat(retencion)) > 0) {
                      var retencionAuxRound = round2(parseFloat(retencion));
                      retencion = round(parseFloat(retencion), 7);
                      if (featureMB) {
                        retencionAuxRound = tipoCambioMB(transactionRecord, book, retencionAuxRound, rounding);
                      }
                      if (parseFloat(retencionAuxRound) > 0) {
                        var telecommTaxesFlows = [1, 3, 4]; //Flujos con impuestos de telecomunicaciones (FUST y FUNTEL)
                        // Para Brasil se consideran los impuestos de telecomunicacion (campo is_exclusive) solo para el Flujo 0 y 2
                        if ((is_exclusive != true && is_exclusive != 'T') && telecommTaxesFlows.indexOf(Number(taxCalculationForm) != -1)) {
                          baseCalculoBR(parseFloat(retencion), j, true);
                        }

                        if (genera == '1') { // Si genera Journal sale del proceso
                          continue;
                        }

                        var arreglo_DetailsItem = new Array();
                        arreglo_DetailsItem.push('I');
                        arreglo_DetailsItem.push(idsubtype);
                        arreglo_DetailsItem.push(subtype);
                        if (clasificacionCC == true || clasificacionCC == 'T') { // Segmentacion de la CC
                          arreglo_DetailsItem.push(elegirSegmentacion(prefDep, department, transactionRecord.getLineItemValue("item", "department", j), depSetup, transactionRecord.getFieldValue("department")));
                          arreglo_DetailsItem.push(elegirSegmentacion(prefClas, class_, transactionRecord.getLineItemValue("item", "class", j), classSetup, transactionRecord.getFieldValue("class")));
                          arreglo_DetailsItem.push(elegirSegmentacion(prefLoc, location, transactionRecord.getLineItemValue("item", "location", j), locSetup, transactionRecord.getFieldValue("location")));
                        } else { // Segmentacion del Item
                          arreglo_DetailsItem.push(elegirSegmentacion(prefDep, transactionRecord.getLineItemValue("item", "department", j), department, depSetup, ''));
                          arreglo_DetailsItem.push(elegirSegmentacion(prefClas, transactionRecord.getLineItemValue("item", "class", j), class_, classSetup, ''));
                          arreglo_DetailsItem.push(elegirSegmentacion(prefLoc, transactionRecord.getLineItemValue("item", "location", j), location, locSetup, ''));
                        }

                        if (accountCC == false || accountCC == 'F') { // Cuentas del Item y Transaccion
                          if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 10 || filtroTransactionType == 7) { // Invoice - Sales Order - Estimate - Bill Credit
                            arreglo_DetailsItem.push(parseFloat(taxItemCuenta)); // Debito - Cuenta del Item
                            arreglo_DetailsItem.push(parseFloat(transactionRecord.getFieldValue("account"))); // Credito - Cuenta de la transaccion
                          }
                          if (filtroTransactionType == 4) { // Bill
                            arreglo_DetailsItem.push(parseFloat(transactionRecord.getFieldValue("account"))); // Debito - Cuenta de la transaccion
                            arreglo_DetailsItem.push(parseFloat(taxItemCuenta)); // Credito - Cuenta del Item
                          }
                          if (filtroTransactionType == 8) { // Credit Memo
                            if (reverse == 1) {
                              arreglo_DetailsItem.push(parseFloat(taxItemCuenta)); // Debito - Cuenta del Item
                              arreglo_DetailsItem.push(parseFloat(transactionRecord.getFieldValue("account"))); // Credito - Cuenta de la transaccion
                            } else {
                              arreglo_DetailsItem.push(parseFloat(transactionRecord.getFieldValue("account"))); // Debito - Cuenta de la transaccion
                              arreglo_DetailsItem.push(parseFloat(taxItemCuenta)); // Credito - Cuenta del Item
                            }
                          }
                        } else { // Cuentas del NT
                          if (filtroTransactionType == 1 || filtroTransactionType == 2 || filtroTransactionType == 10 || filtroTransactionType == 4) { // Invoice - Sales Order - Estimate - Bill
                            arreglo_DetailsItem.push(parseFloat(account1)); // Cuenta Debito - CC
                            arreglo_DetailsItem.push(parseFloat(account2)); // Cuenta Credito - CC
                          }
                          if (filtroTransactionType == 7) { // Bill Credit
                            arreglo_DetailsItem.push(parseFloat(account2)); // Cuenta Debito - CC
                            arreglo_DetailsItem.push(parseFloat(account1)); // Cuenta Credito - CC
                          }
                          if (filtroTransactionType == 8) { // Credit Memo
                            if (reverse == 1) {
                              arreglo_DetailsItem.push(parseFloat(account1)); // Cuenta Debito - CC
                              arreglo_DetailsItem.push(parseFloat(account2)); // Cuenta Credito - CC
                            } else {
                              arreglo_DetailsItem.push(parseFloat(account2)); // Cuenta Debito - CC
                              arreglo_DetailsItem.push(parseFloat(account1)); // Cuenta Credito - CC
                            }
                          }
                        }

                        arreglo_DetailsItem.push(catalogItem);
                        arreglo_DetailsItem.push(retencionAuxRound);
                        arreglo_DetailsItem.push(' (LatamTax - National Taxes) - (ID Item: ' + idItem + ')');

                        for (var s = 0; s < customSegments.length; s++) {
                          var segmentId = customSegments[s];
                          var segmentValue = segmentsNT[segmentId] || segmentsLine[segmentId] || "";
                          arreglo_DetailsItem.push(Number(segmentValue));
                        }

                        if (summary == 'F' || summary == false) {
                          agregarLineas(customLines, book, arreglo_DetailsItem, 0, false, prefDepLine, prefClassLine);
                        } else {
                          arreglo_Items.push(arreglo_DetailsItem);
                        }
                      }
                    } // Fin Retencion > 0
                  } // Fin FlagItem = true
                } // Fin For de Items
              } // Caso 4I : Subsidiaria - Items
            } // Caso 4I / 4E : Subsidiaria - Items / Expenses
          } // Fin for NT
        } // Fin if NT != null

        /******************************************************
         * Resumir las lineas calculadas para Items / Expenses
         ******************************************************/
        if (summary == 'T' || summary == true) {
          var flag;
          nlapiLogExecution("ERROR", "arreglo_Items", arreglo_Items);
          if (arreglo_Items != null && arreglo_Items.length > 0) {
            var arregloOrdenado = arreglo_Items.sort();
            //nlapiLogExecution("ERROR", "arreglo_Items.sort", arregloOrdenado);

            // arreglo_DetailsOrdenado[0] = Caso
            // arreglo_DetailsOrdenado[1] = ID Subtype
            // arreglo_DetailsOrdenado[2] = Subtype
            // arreglo_DetailsOrdenado[3] = Department
            // arreglo_DetailsOrdenado[4] = Class
            // arreglo_DetailsOrdenado[5] = Location
            // arreglo_DetailsOrdenado[6] = Cuenta Debito
            // arreglo_DetailsOrdenado[7] = Cuenta Credito
            // arreglo_DetailsOrdenado[8] = Catalogo BR - EC
            // arreglo_DetailsOrdenado[9] = Retencion
            // arreglo_DetailsOrdenado[10] = Memo + ID Item / Cuenta
            // arreglo_DetailsOrdenado[11 - ..] = Custom Segments
            var groupNumColumns = [0, 1, 3, 4, 5, 6, 7, 8];

            for (var s = 0; s < customSegments.length; s++) {
              groupNumColumns.push(s + 11);
            }

            for (var i = 0; i < arregloOrdenado.length; i++) {
              flag = false;
              var arreglo_DetailsOrdenado = new Array();
              arreglo_DetailsOrdenado = arregloOrdenado[i];
              var retencionAux = arreglo_DetailsOrdenado[9];
              for (var j = i + 1; j < arregloOrdenado.length; j++) {
                var arreglo_DetailsOrdenadoAux = [];
                arreglo_DetailsOrdenadoAux = arregloOrdenado[j];

                var isGrouped = true;

                for (var c = 0; c < groupNumColumns.length; c++) {
                  var numColumn = groupNumColumns[c];
                  isGrouped = isGrouped && (arreglo_DetailsOrdenado[numColumn] == arreglo_DetailsOrdenadoAux[numColumn]);
                }

                if (isGrouped) {
                  retencionAux = parseFloat(retencionAux) + parseFloat(arreglo_DetailsOrdenadoAux[9]);
                  flag = true;
                  if (j == arregloOrdenado.length - 1) {
                    i = arregloOrdenado.length;
                  }
                } else {
                  i = j - 1;
                  break;
                }
              }

              agregarLineas(customLines, book, arreglo_DetailsOrdenado, retencionAux, flag, prefDepLine, prefClassLine);
            }
          }
        }
      } else {
        //Purchase Automatico Flow
        nlapiLogExecution("ERROR", "getAuthorization(527) ", getAuthorization(527, licenses));
        if (getAuthorization(527, licenses) == true && (transactionRecord.id != null && transactionRecord.id != '')) {
          var exchangeRateBook = getExchangeRateByBook(transactionRecord, book);
          nlapiLogExecution("ERROR", "exchangeRateBook", exchangeRateBook);
          var filters = [];
          filters.push(new nlobjSearchFilter("custrecord_lmry_br_transaction", null, "is", transactionRecord.id));
          filters.push(new nlobjSearchFilter("custrecord_lmry_tax_type", null, "anyof", '4'));

          var columns = [];
          columns.push(new nlobjSearchColumn("custrecord_lmry_br_type"));
          columns.push(new nlobjSearchColumn("custrecord_lmry_br_total"));
          columns.push(new nlobjSearchColumn("custrecord_lmry_br_positem"));
          columns.push(new nlobjSearchColumn("custrecord_lmry_item"));
          columns.push(new nlobjSearchColumn("custrecord_lmry_ccl"));
          columns.push(new nlobjSearchColumn("custrecord_lmry_ntax"));
          columns.push(new nlobjSearchColumn("custrecord_lmry_br_is_import_tax_result"));
          columns.push(new nlobjSearchColumn("custrecord_lmry_ccl_br_nivel_contabiliz", "custrecord_lmry_ccl"));
          columns.push(new nlobjSearchColumn("custrecord_lmry_nt_br_nivel_contabiliz", "custrecord_lmry_ntax"));
          columns.push(new nlobjSearchColumn("custrecord_lmry_is_substitution_tax_resu"));
          columns.push(new nlobjSearchColumn("custrecord_lmry_is_tax_not_included", "custrecord_lmry_br_type_id"));

          var search_taxResults = nlapiCreateSearch("customrecord_lmry_br_transaction", filters, columns);
          var results = search_taxResults.runSearch().getResults(0, 1000);
          nlapiLogExecution("ERROR", "results ", results.length);
          if (results && results.length) {
            for (var i = 0; i < results.length; i++) {
              var subtype = results[i].getValue('custrecord_lmry_br_type');
              var amount = results[i].getValue('custrecord_lmry_br_total');
              amount = round2(round2(amount) * exchangeRateBook);

              if (parseFloat(amount) <= 0) {
                continue;
              }
              var item = results[i].getValue('custrecord_lmry_item');
              var position = parseInt(results[i].getValue("custrecord_lmry_br_positem")) + 1;
              var ccl = results[i].getValue('custrecord_lmry_ccl');
              var ntax = results[i].getValue('custrecord_lmry_ntax');
              var isImportTax = results[i].getValue("custrecord_lmry_br_is_import_tax_result");
              var isTaxSubstitution = results[i].getValue("custrecord_lmry_is_substitution_tax_resu");
              var isTaxNotIncluded = results[i].getValue("custrecord_lmry_is_tax_not_included", "custrecord_lmry_br_type_id");
              var creditAcc = '';
              var debitAcc = '';
              var glimpact = '';
              var segmentConfig = '';
              var labelmemo = '';

              if (Number(apTaxFlow) == 4) {
                if ((isTaxSubstitution == "T" || isTaxSubstitution == true) || (isTaxNotIncluded == "T" || isTaxNotIncluded == true)) {
                  continue;
                }
              }

              nlapiLogExecution("ERROR", "ccl ", ccl);
              if (ccl != null && ccl != '') {
                //nlapiLogExecution("ERROR", "entro ccl ", ccl);
                var importTaxLevel = results[i].getValue("custrecord_lmry_ccl_br_nivel_contabiliz", "custrecord_lmry_ccl");
                if ((isImportTax == "T" || isImportTax == true) && Number(importTaxLevel) != 1) {
                  continue;
                }

                var cust_fields = ['custrecord_lmry_br_ccl_account2', 'custrecord_lmry_br_ccl_account1', 'custrecord_lmry_ccl_gl_impact', 'custrecord_lmry_ccl_config_segment'];
                var dataCC = nlapiLookupField('customrecord_lmry_ar_contrib_class', ccl, cust_fields);
                if (reverse == 1) {
                  debitAcc = dataCC.custrecord_lmry_br_ccl_account2;
                  creditAcc = dataCC.custrecord_lmry_br_ccl_account1;
                } else {
                  debitAcc = dataCC.custrecord_lmry_br_ccl_account1;
                  creditAcc = dataCC.custrecord_lmry_br_ccl_account2;
                }
                glimpact = dataCC.custrecord_lmry_ccl_gl_impact;
                segmentConfig = dataCC.custrecord_lmry_ccl_config_segment;
                labelmemo = 'Contributory Class';
              } else if (ntax != null && ntax != '') {
                var importTaxLevel = results[i].getValue("custrecord_lmry_nt_br_nivel_contabiliz", "custrecord_lmry_ntax");
                if ((isImportTax == "T" || isImportTax == true) && Number(importTaxLevel) != 1) {
                  continue;
                }

                var cust_fields = ['custrecord_lmry_ntax_credit_account', 'custrecord_lmry_ntax_debit_account', 'custrecord_lmry_ntax_gl_impact', 'custrecord_lmry_ntax_config_segment'];
                var dataNT = nlapiLookupField('customrecord_lmry_national_taxes', ntax, cust_fields);
                if (reverse == 1) {
                  debitAcc = dataNT.custrecord_lmry_ntax_credit_account;
                  creditAcc = dataNT.custrecord_lmry_ntax_debit_account;
                } else {
                  debitAcc = dataNT.custrecord_lmry_ntax_debit_account;
                  creditAcc = dataNT.custrecord_lmry_ntax_credit_account;
                }
                glimpact = dataNT.custrecord_lmry_ntax_gl_impact;
                segmentConfig = dataNT.custrecord_lmry_ntax_config_segment;
                labelmemo = 'National Taxes';
              } else {
                continue;
              }
              /*nlapiLogExecution("ERROR", "debitAcc ", debitAcc);
              nlapiLogExecution("ERROR", "creditAcc ", creditAcc);
              nlapiLogExecution("ERROR", "glimpact ", glimpact);
              nlapiLogExecution("ERROR", "segmentConfig ", segmentConfig);*/

              if (segmentConfig) {
                segmentConfig = JSON.parse(segmentConfig);
              } else {
                segmentConfig = {};
              }

              if (glimpact == false || glimpact == 'F') {
                continue;
              }

              var department = transactionRecord.getLineItemValue("item", "department", position) || transactionRecord.getFieldValue("department") || "0";
              var class_ = transactionRecord.getLineItemValue("item", "class", position) || transactionRecord.getFieldValue("class") || "0";
              var location = transactionRecord.getLineItemValue("item", "location", position) || transactionRecord.getFieldValue("location") || "0";

              if (clasificacionCC == true || clasificacionCC == 'T') { // Segmentacion de la Clase Contributiva
                var dep1 = elegirSegmentacion(prefDep, department, transactionRecord.getFieldValue("department"), depSetup, transactionRecord.getFieldValue("department"));
                var cla1 = elegirSegmentacion(prefClas, class_, transactionRecord.getFieldValue("class"), classSetup, transactionRecord.getFieldValue("class"));
                var loc1 = elegirSegmentacion(prefLoc, location, transactionRecord.getFieldValue("location"), locSetup, transactionRecord.getFieldValue("location"));
              } else { // Segmentacion de la Transaccion
                var dep1 = elegirSegmentacion(prefDep, transactionRecord.getFieldValue("department"), department, depSetup, '');
                var cla1 = elegirSegmentacion(prefClas, transactionRecord.getFieldValue("class"), class_, classSetup, '');
                var loc1 = elegirSegmentacion(prefLoc, transactionRecord.getFieldValue("location"), location, locSetup, '');
              }

              // Cuenta dependiendo del Libro Contable
              if (!book.isPrimary()) {
                debitAcc = getAccount(debitAcc, dep1, cla1, loc1);
                creditAcc = getAccount(creditAcc, dep1, cla1, loc1);
              }

              var newLineDebit = customLines.addNewLine();
              newLineDebit.setDebitAmount(amount);
              newLineDebit.setAccountId(parseFloat(debitAcc));
              newLineDebit.setMemo(subtype + ' (LatamTax - ' + labelmemo + ')');
              if (dep1 != '' && dep1 != null && dep1 != 0 && (prefDepLine == true || prefDepLine == 'T')) {
                newLineDebit.setDepartmentId(parseInt(dep1));
              }
              if (cla1 != '' && cla1 != null && cla1 != 0 && (prefClassLine == true || prefClassLine == 'T')) {
                newLineDebit.setClassId(parseInt(cla1));
              }
              if (loc1 != '' && loc1 != null && loc1 != 0) {
                newLineDebit.setLocationId(parseInt(loc1));
              }

              if (customSegments.length) {
                for (var s = 0; s < customSegments.length; s++) {
                  var segmentId = customSegments[s];
                  var segmentValue = segmentConfig[segmentId] || transactionSegments[segmentId] || "";

                  if (segmentValue) {
                    newLineDebit.setSegmentValueId(segmentId, parseInt(segmentValue));
                  }
                }
              }

              newLineDebit.setEntityId(parseInt(entity));

              var newLineCredit = customLines.addNewLine();
              newLineCredit.setCreditAmount(amount);
              newLineCredit.setAccountId(parseFloat(creditAcc));
              newLineCredit.setMemo(subtype + ' (LatamTax - ' + labelmemo + ')');
              if (dep1 != '' && dep1 != null && dep1 != 0 && (prefDepLine == true || prefDepLine == 'T')) {
                newLineCredit.setDepartmentId(parseInt(dep1));
              }
              if (cla1 != '' && cla1 != null && cla1 != 0 && (prefClassLine == true || prefClassLine == 'T')) {
                newLineCredit.setClassId(parseInt(cla1));
              }
              if (loc1 != '' && loc1 != null && loc1 != 0) {
                newLineCredit.setLocationId(parseInt(loc1));
              }

              if (customSegments.length) {
                for (var s = 0; s < customSegments.length; s++) {
                  var segmentId = customSegments[s];
                  var segmentValue = segmentConfig[segmentId] || transactionSegments[segmentId] || "";

                  if (segmentValue) {
                    newLineCredit.setSegmentValueId(segmentId, parseInt(segmentValue));
                  }
                }
              }

              newLineCredit.setEntityId(parseInt(entity));


            }
          }
        }

      }
      /*************************************************************************************
       * Logica del Tax Calculator BR - FE
       *************************************************************************************/
    } else {
      if (getAuthorization(147, licenses) == true) {
        agregarTaxCalculatorBR(transactionRecord, customLines, book, rounding, summary);
      }
    }
    //nlapiLogExecution("ERROR", "Unidades de memoria", usageRemaining);
  } catch (err) {
    //nlapiLogExecution('ERROR', 'customizeGlImpact', err);
    sendemail(' [ customizeGlImpact ] ' + err, LMRY_script);
  }
}

/********************************************************
 * Funcion que valida si el flujo debe correr en el pais
 * Parámetros :
 *      country : 3 primeras letras del pais
 *      createWHT : check "LatamReady - Applied WHT Code"
 *      transactionType :  tipo de Transaccion
 ********************************************************/
function validarPais(country, transactionType, licenses) {
  try {
    if (country.toUpperCase() == "ARG") {
      if (getAuthorization(200, licenses) == true) {
        return true;
      }
    }
    if (country.toUpperCase() == "BOL") {
      if (getAuthorization(152, licenses) == true) {
        return true;
      }
    }
    if (country.toUpperCase() == "CHI") {
      if (getAuthorization(201, licenses) == true) {
        return true;
      }
    }
    if (country.toUpperCase() == "COL") {
      if (getAuthorization(150, licenses) == true) {
        return true;
      }
    }
    if (country.toUpperCase() == "COS") {
      if (getAuthorization(203, licenses) == true) {
        return true;
      }
    }
    if (country.toUpperCase() == "ECU") {
      if (getAuthorization(153, licenses) == true) {
        return true;
      }
    }
    if (country.toUpperCase() == "EL ") {
      if (getAuthorization(205, licenses) == true) {
        return true;
      }
    }
    if (country.toUpperCase() == "GUA") {
      if (getAuthorization(207, licenses) == true) {
        return true;
      }
    }
    if (country.toUpperCase() == "MEX") {
      if (getAuthorization(209, licenses) == true) {
        return true;
      }
    }
    if (country.toUpperCase() == "PAN") {
      if (getAuthorization(211, licenses) == true) {
        return true;
      }
    }
    if (country.toUpperCase() == "PAR") {
      if (getAuthorization(213, licenses) == true) {
        return true;
      }
    }
    if (country.toUpperCase() == "PER") {
      if (getAuthorization(214, licenses) == true) {
        return true;
      }
    }
    if (country.toUpperCase() == "URU") {
      if (getAuthorization(216, licenses) == true) {
        return true;
      }
    }

    if (country.toUpperCase() == "BRA") {
      if (getAuthorization(147, licenses) == true) {
        return true;
      }
    }

    return false;
  } catch (err) {
    //nlapiLogExecution('ERROR', 'validarPais', err);
    sendemail(' [ validarPais ] ' + err, LMRY_script);
  }
}

/****************************************************************************
 * Funcion que Agrega las Lineas al Suite GL
 * Parámetros :
 *      customLines, book : parametro de la funcion principal
 *      arregloLineas : arreglo que contiene todas las lineas
 *      retencionSum : Monto total de la Sumarizacion
 *      flagSum : False: No sumariza, True: Sumariza
 *      prefDepLine, prefClassLine : configuracion de preferencias generales
 ***************************************************************************/
function agregarLineas(customLines, book, arregloLineas, retencionSum, flagSum, prefDepLine, prefClassLine) {

  try {

    //nlapiLogExecution("ERROR",'arreglo Lineas',arregloLineas);
    var memo = '';
    if (flagSum == false) {
      retencionSum = arregloLineas[9];
      memo = arregloLineas[2] + arregloLineas[10];
    } else {
      switch (arregloLineas[0]) {
        case 'I':
          memo = arregloLineas[2] + ' (Summarized - Items)';
          break;
        case 'E':
          memo = arregloLineas[2] + ' (Summarized - Expenses)';
          break;
      }
    }

    if (!book.isPrimary()) {
      //nlapiLogExecution('error','no es book primario x items creo',arregloLineas[6]);
      arregloLineas[6] = getAccount(arregloLineas[6], arregloLineas[3], arregloLineas[4], arregloLineas[5]);
      arregloLineas[7] = getAccount(arregloLineas[7], arregloLineas[3], arregloLineas[4], arregloLineas[5]);
      arregloLineas[6] = parseFloat(arregloLineas[6]);
      arregloLineas[7] = parseFloat(arregloLineas[7]);
    }

    nlapiLogExecution("ERROR", "glLine[caso, idSubtype, subtype, dep, class, loc, debitAcc, creditAcc,catalogo,amount, memo]", JSON.stringify(arregloLineas));

    var newLineDebit = customLines.addNewLine();
    newLineDebit.setDebitAmount(retencionSum);
    newLineDebit.setAccountId(arregloLineas[6]);
    newLineDebit.setMemo(memo);
    if (arregloLineas[3] != null && arregloLineas[3] != '' && (prefDepLine == true || prefDepLine == 'T')) {
      newLineDebit.setDepartmentId(parseInt(arregloLineas[3]));
    }
    if (arregloLineas[4] != null && arregloLineas[4] != '' && (prefClassLine == true || prefClassLine == 'T')) {
      newLineDebit.setClassId(parseInt(arregloLineas[4]));
    }
    if (arregloLineas[5] != null && arregloLineas[5] != '') {
      newLineDebit.setLocationId(parseInt(arregloLineas[5]));
    }

    for (var s = 0; s < customSegments.length; s++) {
      var segmentValue = arregloLineas[s + 11];
      if (segmentValue) {
        newLineDebit.setSegmentValueId(customSegments[s], parseInt(segmentValue));
      }
    }

    newLineDebit.setEntityId(parseInt(entity));

    var newLineCredit = customLines.addNewLine();
    newLineCredit.setCreditAmount(retencionSum);
    newLineCredit.setAccountId(arregloLineas[7]);
    newLineCredit.setMemo(memo);
    if (arregloLineas[3] != null && arregloLineas[3] != '' && (prefDepLine == true || prefDepLine == 'T')) {
      newLineCredit.setDepartmentId(parseInt(arregloLineas[3]));
    }
    if (arregloLineas[4] != null && arregloLineas[4] != '' && (prefClassLine == true || prefClassLine == 'T')) {
      newLineCredit.setClassId(parseInt(arregloLineas[4]));
    }
    if (arregloLineas[5] != null && arregloLineas[5] != '') {
      newLineCredit.setLocationId(parseInt(arregloLineas[5]));
    }

    for (var s = 0; s < customSegments.length; s++) {
      var segmentValue = arregloLineas[s + 11];
      if (segmentValue) {
        newLineCredit.setSegmentValueId(customSegments[s], parseInt(segmentValue));
      }
    }

    newLineCredit.setEntityId(parseInt(entity));

  } catch (err) {
    //nlapiLogExecution('ERROR', 'agregarLineas', err);
    sendemail(' [ agregarLineas ] ' + err, LMRY_script);
  }
}

/***************************************************************************
 * Funcion que devuelve el tipo de cambio configurada para el Libro Contable
 * Parámetros :
 *      transactionRecord : transaccion
 *      book : parametro de la funcion principal
 *      retencionMB : retencion calculada
 *      rounding : 1: Redondear, 2: Truncar, Vacío: Mantener dos decimales
 **************************************************************************/
function tipoCambioMB(transactionRecord, book, retencionMB, rounding) {

  var exchangeRate_mb = 1;

  if (book.isPrimary()) {
    exchangeRate_mb = transactionRecord.getFieldValue("exchangerate");
  } else {
    var bookId = book.getId();
    for (var line = 1; line <= transactionRecord.getLineItemCount('accountingbookdetail'); line++) {
      if (bookId == transactionRecord.getLineItemValue('accountingbookdetail', 'bookid', line)) {
        exchangeRate_mb = transactionRecord.getLineItemValue('accountingbookdetail', 'exchangerate', line);
        break;
      }
    }
  }

  retencionMB = parseFloat(retencionMB * parseFloat(exchangeRate_mb));
  retencionMB = round2(retencionMB);

  return retencionMB;
}

/***********************************************************************************
 * Funcion que selecciona la segmentación de las líneas en el GL Impact dependiendo
 * de la configuración en el récord "LatamReady - Setup Tax Subsidiary"
 * Parámetros :
 *      pref : segmentacion obligatoria en Preferencias Generales
 *      valor1 / valor2 : Segmentacion de la transaccion o CC/NT segun configuracion
 *      valorSetup : segmentación del Setup Tax Subsidiary
 *      valorDefecto : segmentación de la transacción
 ***********************************************************************************/
function elegirSegmentacion(pref, valor1, valor2, valorSetup, valorDefecto) {

  try {
    if (valor1 != null && valor1 != '') {
      return valor1;
    } else {
      if (pref == 'T' || pref == true) {
        if (valor2 == null || valor2 == '') {
          return valorSetup;
        } else {
          return valor2;
        }
      } else {
        if (valorDefecto != '' && valorDefecto != null) {
          return valorDefecto;
        }
      }
    }
    return '';
  } catch (err) {
    //nlapiLogExecution('ERROR', 'elegirSegmentacion', err);
    sendemail(' [ elegirSegmentacion ] ' + err, LMRY_script);
  }
}

/*************************************************************************
 * Funcion que redondea o trunca los montos dependiendo de la
 * configuración en el récord "LatamReady - Setup Tax Subsidiary"
 * Parámetros :
 *      ret : monto a Redondear / Truncar
 *      rounding : 1: Redondear, 2: Truncar, Vacio: Mantener dos decimales
 *************************************************************************/
function typeRounding(ret, rounding) {
  var retAux = round2(ret);
  var decimal;
  switch (rounding) {
    case '1': // Redondear
      decimal = parseFloat(ret) - parseInt(ret);
      if (decimal < 0.5) {
        retAux = parseInt(ret);
      } else {
        retAux = parseInt(ret) + 1;
      }
      break;
    case '2': // Truncar
      retAux = parseInt(ret);
      break;
  }
  retAux = round2(retAux);
  return retAux;
}

/***********************************************************************************
 * Funcion que realiza la suma de Porcentajes para calcular el monto base
 * (Pais: Brasil)
 * Parámetros :
 *      searchResultCC_NT : Busqueda de la CC o NT
 *      caso : 1: Caso Totales, 2I: Caso Items
 *      id_appliesto, id_taxrate, id_taxrateSuma : Id's de los campos de la CC o NT
 *      id_line, id_catalogItem : id de la línea / catalogo del item
 ***********************************************************************************/
function sumaPorcentajes(searchResultCC_NT, caso, id_appliesto, id_taxrate, id_taxrateSuma, id_line, id_catalogItem, subtype) {

  try {
    var sumaPorc = parseFloat(0);
    for (var i = 0; i < searchResultCC_NT.length; i++) {
      var applies_toBR = searchResultCC_NT[i].getValue(id_appliesto);
      var taxrateBR = searchResultCC_NT[i].getValue(id_taxrate);
      var taxrateSuma = searchResultCC_NT[i].getValue(id_taxrateSuma);
      var isTaxByLocation = searchResultCC_NT[i].getValue("custrecord_lmry_tax_by_location", subtype);

      if ((isTaxByLocation == true || isTaxByLocation == 'T') && (applyWHT == true || applyWHT == 'T')) {
        continue;
      }

      if (taxrateSuma != '' && taxrateSuma != null) {
        taxrateBR = parseFloat(taxrateSuma) / 100;
      }
      switch (caso) {
        case '1':
          if (applies_toBR == 1) {
            sumaPorc = parseFloat(sumaPorc + parseFloat(taxrateBR));
          }
          break;
        case '2I':
        case '2E':
          var catalogItemBR = searchResultCC_NT[i].getValue(id_line);
          if (catalogItemBR != '' && catalogItemBR != null && catalogItemBR == id_catalogItem) {
            sumaPorc = parseFloat(sumaPorc + parseFloat(taxrateBR));
          }
          break;
      }
    }
    return parseFloat(sumaPorc);
  } catch (err) {
    //nlapiLogExecution('ERROR', 'sumaPorcentajes', err);
    sendemail(' [ sumaPorcentajes ] ' + err, LMRY_script);
  }
}

/***************************************************************************
 * Funcion que realiza la sumatoria de los Impuestos No Excluyentes para la
 * formula del Monto Base de los Impuestos Excluyentes (Pais: Brasil)
 * Parámetros :
 *      retencionBR : impuesto calculado
 *      n : línea del item
 *      blnBR : False: Impuesto Excluyente , True: Impuesto no Excluyente
 **************************************************************************/
function baseCalculoBR(retencionBR, n, blnBR) {

  if (arreglo_IndiceBaseBR.length != 0) {
    for (var k = 0; k < arreglo_IndiceBaseBR.length; k++) {
      if (arreglo_IndiceBaseBR[k] == n) {
        if (blnBR == true) { // Inserta la sumatoria de los Excluyentes
          arreglo_SumaBaseBR[k] = parseFloat(arreglo_SumaBaseBR[k]) + parseFloat(retencionBR);
          return 0;
        } else { // Obtiene la suma de los No Excluyentes
          return arreglo_SumaBaseBR[k];
        }
      }
    }
  }

  arreglo_IndiceBaseBR.push(n);
  arreglo_SumaBaseBR.push(parseFloat(retencionBR));
  return 0;
}

/*************************************************************
 * Funcion que concatena los Impuestos Exentos para un cliente
 * (Pais: Brasil)
 * Parámetros :
 *      entityID : ID del Cliente
 *************************************************************/
function exemptTaxBR(entityID) {
  var texto = "";
  var exemptTax = nlapiLookupField('customer', entityID, 'custentity_lmry_br_exempt_tax');

  if (exemptTax) {
    var texto = exemptTax.split(',');
  }

  return texto;
}

/*****************************************************************
 * Funcion que extrae los impuestos de las lineas para el Suite GL
 * (Tax Calculator - FE - Brasil)
 * Parámetros :
 *      transactionRecord : transaccion
 *      customLines , book : parametros de la funcion principal
 *****************************************************************/
function agregarTaxCalculatorBR(transactionRecord, customLines, book, rounding, summary) {

  try {

    if (transactionRecord.getId()) {
      var exchangeRateBook = getExchangeRateByBook(transactionRecord, book);
      var configTaxes = getTaxCalculatorConfigTaxes(transactionRecord);
      nlapiLogExecution('ERROR', 'configTaxes', JSON.stringify(configTaxes));
      var taxResults = getTaxCalculatorTaxResults(transactionRecord, configTaxes, summary);
      nlapiLogExecution('ERROR', 'taxResults', JSON.stringify(taxResults));

      if (summary == "T" || summary == true) {
        for (var kGroup in taxResults["summary"]) {
          var taxResult = taxResults["summary"][kGroup];
          var debitAccount = taxResult["debitaccount"];
          var creditAccount = taxResult["creditaccount"];

          var amount = parseFloat(taxResult["total"]);
          if (featureMB == "T" || featureMB == true) {
            amount = parseFloat(amount * parseFloat(exchangeRateBook));
            amount = round2(amount);
          }

          var summarized = (taxResult["items"].length > 1);
          var idItem = taxResult["items"][0] || "";
          if (amount && debitAccount && creditAccount) {
            var subtype = taxResult["subtype"];
            var department = taxResult["department"];
            var class_ = taxResult["class"];
            var location = taxResult["location"];
            var csegments = taxResult["csegments"];
            agregarLineaTaxCalculator(customLines, subtype, idItem, amount, debitAccount, creditAccount, book, summarized, department, class_, location, csegments);
          }
        }
      } else {
        for (var i = 0; i < taxResults["lines"].length; i++) {
          var taxResult = taxResults["lines"][i];
          var debitAccount = taxResult["debitaccount"];
          var creditAccount = taxResult["creditaccount"];

          var amount = parseFloat(taxResult["amount"]);
          if (featureMB == "T" || featureMB == true) {
            amount = parseFloat(amount * parseFloat(exchangeRateBook));
            amount = round2(amount);
          }
          var idItem = taxResult["item"] || "";
          if (amount && debitAccount && creditAccount) {
            var subtype = taxResult["subtype"];
            var department = taxResult["department"];
            var class_ = taxResult["class"];
            var location = taxResult["location"];
            var csegments = taxResult["csegments"];

            agregarLineaTaxCalculator(customLines, subtype, idItem, amount, debitAccount, creditAccount, book, false, department, class_, location, csegments);
          }
        }
      }

    }
  } catch (err) {
    //nlapiLogExecution('ERROR', 'agregarTaxCalculatorBR', err);
    sendemail(' [ agregarTaxCalculatorBR ] ' + err, LMRY_script);
  }
}

function getTaxCalculatorTaxResults(transactionRecord, configTaxes, summary) {
  var taxResults = { "summary": {}, "lines": [] };
  var filters = [
    new nlobjSearchFilter("custrecord_lmry_br_transaction", null, "is", transactionRecord.id),
    new nlobjSearchFilter("custrecord_lmry_tax_type", null, "anyof", '4'),
    new nlobjSearchFilter("custrecord_lmry_total_item", null, "startswith", "Tax Calculator")
  ];

  var columns = [
    new nlobjSearchColumn("custrecord_lmry_br_type"),
    new nlobjSearchColumn("custrecord_lmry_br_total"),
    new nlobjSearchColumn("custrecord_lmry_br_positem"),
    new nlobjSearchColumn("custrecord_lmry_item")
  ];

  var search_taxResults = nlapiCreateSearch("customrecord_lmry_br_transaction", filters, columns);
  var results = search_taxResults.runSearch().getResults(0, 1000);

  if (results && results.length) {
    for (var i = 0; i < results.length; i++) {
      var subtype = results[i].getValue('custrecord_lmry_br_type');
      var amount = results[i].getValue('custrecord_lmry_br_total');
      var item = results[i].getValue('custrecord_lmry_item');
      var position = parseInt(results[i].getValue("custrecord_lmry_br_positem")) + 1;

      if (configTaxes[subtype] && parseFloat(amount) > 0) {

        var department = configTaxes[subtype]["department"] || transactionRecord.getLineItemValue("item", "department", position) || transactionRecord.getFieldValue("department") || "0";
        var class_ = configTaxes[subtype]["class"] || transactionRecord.getLineItemValue("item", "class", position) || transactionRecord.getFieldValue("class") || "0";
        var location = configTaxes[subtype]["location"] || transactionRecord.getLineItemValue("item", "location", position) || transactionRecord.getFieldValue("location") || "0";

        var groupCols = [subtype, department, class_, location];
        var csegments = {};
        if (customSegments.length) {
          for (var s = 0; s < customSegments.length; s++) {
            var segmentId = customSegments[s];
            var segmentValue = configTaxes[subtype][segmentId] || transactionRecord.getLineItemValue("item", segmentId, position) || transactionRecord.getFieldValue(segmentId) || "0";
            groupCols.push(segmentValue);
            csegments[segmentId] = segmentValue;
          }
        }

        if (summary == 'T' || summary == true) {
          var kGroup = groupCols.join("-");
          if (!taxResults['summary'][kGroup]) {
            taxResults['summary'][kGroup] = {
              "debitaccount": configTaxes[subtype]["debitaccount"], "creditaccount": configTaxes[subtype]["creditaccount"],
              "subtype": subtype, "total": 0.00, "items": [], "department": department,
              "class": class_, "location": location, "csegments": csegments
            };
          }
          taxResults['summary'][kGroup]["total"] += round2(amount);
          taxResults['summary'][kGroup]["items"].push(item);
        } else {
          taxResults['lines'].push({
            "subtype": subtype, "debitaccount": configTaxes[subtype]["debitaccount"], "creditaccount": configTaxes[subtype]["creditaccount"],
            'amount': parseFloat(amount), 'item': item, "department": department, "class": class_, "location": location, "csegments": csegments
          });
        }
      }
    }
  }

  return taxResults;
}

/************************************************************************************
 * Funcion que agrega las lineas al Suite GL dependiendo del impuesto
 * (Tax Calculator - FE - Brasil)
 * Parámetros :
 *      customLines , book : parametros de la funcion principal
 *      typeTax : tipo de impuesto
 *      idItemBR, retencionBR, debitAccountTaxBR, creditAccountTaxBR : datos del item
 ************************************************************************************/
function agregarLineaTaxCalculator(customLines, typeTax, idItemBR, retencionBR, debitAccountTaxBR, creditAccountTaxBR, book, summarized, department, class_, location, csegments) {

  try {
    var FEAT_DEPT = objContext.getFeature("departments");
    var FEAT_CLASS = objContext.getFeature("classes");
    var FEAT_LOC = objContext.getFeature("locations");

    var PREF_CLASSESPERLINE = objContext.getPreference("CLASSESPERLINE");
    var PREF_DEPTSPERLINE = objContext.getPreference("DEPTSPERLINE");


    // Si es diferente del Libro Primario, busca la cuenta
    if (!book.isPrimary()) {
      debitAccountTaxBR = getAccount(debitAccountTaxBR, department, class_, location);
      creditAccountTaxBR = getAccount(creditAccountTaxBR, department, class_, location);
    }

    var memo = '';
    if (summarized) {
      memo = typeTax + ' (Tax Calculator) - (Summarized - Items)';
    } else {
      memo = typeTax + ' (Tax Calculator) - (ID Item: ' + idItemBR + ')';
    }

    var newLineDebit = customLines.addNewLine();
    newLineDebit.setDebitAmount(round2(retencionBR));
    newLineDebit.setAccountId(parseFloat(debitAccountTaxBR));
    newLineDebit.setMemo(memo);
    nlapiLogExecution("DEBUG", "entity", entity);
    if (entity) {
      newLineDebit.setEntityId(parseInt(entity));
    }

    if (Number(department) && (FEAT_DEPT == "T" || FEAT_DEPT == true) && (PREF_DEPTSPERLINE == "T" || PREF_DEPTSPERLINE == true)) {
      newLineDebit.setDepartmentId(parseInt(department));
    }

    if (Number(class_) && (FEAT_CLASS == "T" || FEAT_CLASS == true) && (PREF_CLASSESPERLINE == "T" || PREF_CLASSESPERLINE == true)) {
      newLineDebit.setClassId(parseInt(class_));
    }

    if (Number(location) && (FEAT_LOC == "T" || FEAT_LOC == true)) {
      newLineDebit.setLocationId(parseInt(location));
    }

    for (var i = 0; i < customSegments.length; i++) {
      var segmentId = customSegments[i];
      var segmentValue = csegments[segmentId];
      if (Number(segmentValue)) {
        newLineDebit.setSegmentValueId(segmentId, parseInt(segmentValue));
      }
    }

    var newLineCredit = customLines.addNewLine();
    newLineCredit.setCreditAmount(round2(retencionBR));
    newLineCredit.setAccountId(parseFloat(creditAccountTaxBR));
    newLineCredit.setMemo(memo);
    if (entity) {
      newLineCredit.setEntityId(parseInt(entity));
    }

    if (Number(department) && (FEAT_DEPT == "T" || FEAT_DEPT == true) && (PREF_DEPTSPERLINE == "T" || PREF_DEPTSPERLINE == true)) {
      newLineCredit.setDepartmentId(parseInt(department));
    }

    if (Number(class_) && (FEAT_CLASS == "T" || FEAT_CLASS == true) && (PREF_CLASSESPERLINE == "T" || PREF_CLASSESPERLINE == true)) {
      newLineCredit.setClassId(parseInt(class_));
    }

    if (Number(location) && (FEAT_LOC == "T" || FEAT_LOC == true)) {
      newLineCredit.setLocationId(parseInt(location));
    }

    for (var i = 0; i < customSegments.length; i++) {
      var segmentId = customSegments[i];
      var segmentValue = csegments[segmentId];
      if (Number(segmentValue)) {
        newLineCredit.setSegmentValueId(segmentId, parseInt(segmentValue));
      }
    }

  } catch (err) {
    //nlapiLogExecution('ERROR', 'agregarLineaTaxCalculator', err);
    sendemail(' [ agregarLineaTaxCalculator ] ' + err, LMRY_script);
  }
}

/********************************************************************
 * Funcion que devuelve la cuenta configurada para el Libro Contable
 * Parámetros :
 *      cuentaSource : Cuenta configurada en la CC o NT
 *      currentBook : Id del Libro Contable
 ********************************************************************/
function devolverCuenta(cuentaSource, currentBook) {

  try {

    if (FEAT_ACC_MAPPING == true || FEAT_ACC_MAPPING == 'T') {
      var filtros_gam = new Array();
      filtros_gam[0] = new nlobjSearchFilter('sourceaccount', null, 'anyof', cuentaSource);
      filtros_gam[1] = new nlobjSearchFilter('accountingbook', null, 'anyof', currentBook);
      filtros_gam[2] = new nlobjSearchFilter('effectivedate', null, 'onorbefore', fecha);
      //filtros_gam[3] = new nlobjSearchFilter('enddate', null, 'onorafter', fecha);
      if (featureSubs) {
        filtros_gam[3] = new nlobjSearchFilter('subsidiary', null, 'anyof', subsidiary);
      }

      var columnas_gam = new Array();
      columnas_gam[0] = new nlobjSearchColumn("internalid");
      columnas_gam[1] = new nlobjSearchColumn("destinationaccount");
      columnas_gam[2] = new nlobjSearchColumn("enddate");

      var search_gam = nlapiCreateSearch('globalaccountmapping', filtros_gam, columnas_gam);
      var result_gam = search_gam.runSearch().getResults(0, 1000);

      if (result_gam && result_gam.length) {
        for (var m = 0; m < result_gam.length; m++) {
          var fechaFinAcc = result_gam[m].getValue("enddate");
          if (fechaFinAcc == '' || fechaFinAcc == null) {
            return result_gam[m].getValue('destinationaccount');
          } else {
            if (yyymmdd(fecha) <= yyymmdd(fechaFinAcc)) {
              return result_gam[m].getValue('destinationaccount');
            }
          }
        }
      }
    }

    return cuentaSource;

  } catch (err) {
    //nlapiLogExecution('ERROR', 'devolverCuenta', err);
    sendemail(' [ devolverCuenta ] ' + err, LMRY_script);
  }
}

function getAccount(cuentaSource, dep, cla, loc) {
  try {
    for (line in Json_GMA) {
      if (line == cuentaSource) {
        if (Json_GMA[line].department != 0 && Json_GMA[line].department != null && Json_GMA[line].department != '' && Json_GMA[line].department != undefined) {
          if (Json_GMA[line].department != dep) {
            return cuentaSource;
          }
        }
        if (Json_GMA[line].class != 0 && Json_GMA[line].class != null && Json_GMA[line].class != '' && Json_GMA[line].class != undefined) {
          if (Json_GMA[line].class != cla) {
            return cuentaSource;
          }
        }
        if (Json_GMA[line].location != 0 && Json_GMA[line].location != null && Json_GMA[line].location != '' && Json_GMA[line].location != undefined) {
          if (Json_GMA[line].location != loc) {
            return cuentaSource;
          }
        }
        var fechafin = Json_GMA[line].enddate;
        if (fechafin == '' || fechafin == null) {
          return Json_GMA[line].destination;
        } else {
          if (yyymmdd(fecha) <= yyymmdd(fechafin)) {
            return Json_GMA[line].destination;
          }
        }
      }
    }
  } catch (err) {
    nlapiLogExecution('ERROR', 'getAccount', err);
    throw ' [ getAccount ] ' + err;
  }
  return cuentaSource;
}

/********************************************************************
 * Funcion que devuelve el JSON de cuentas para el Libro Contable
 * Parámetros :
 *      currentBook : Id del Libro Contable
 ********************************************************************/
function obtainsAccounts(currentBook) {
  try {
    if (FEAT_ACC_MAPPING == true || FEAT_ACC_MAPPING == 'T') {
      var filtros_gam = new Array();
      filtros_gam[0] = new nlobjSearchFilter('effectivedate', null, 'onorbefore', fecha);
      filtros_gam[1] = new nlobjSearchFilter('accountingbook', null, 'is', currentBook);
      if (featureSubs) {
        filtros_gam[2] = new nlobjSearchFilter('subsidiary', null, 'anyof', subsidiary);
      }

      var aux = 4;
      var columnas_gam = new Array();
      columnas_gam[0] = new nlobjSearchColumn("internalid");
      columnas_gam[1] = new nlobjSearchColumn("destinationaccount");
      columnas_gam[2] = new nlobjSearchColumn("enddate");
      columnas_gam[3] = new nlobjSearchColumn("sourceaccount");
      if (featureDep == 'T' || featureDep == true) {
        columnas_gam[aux] = new nlobjSearchColumn("department");
        aux++;
      }
      if (featureCla == 'T' || featureCla == true) {
        columnas_gam[aux] = new nlobjSearchColumn("class");
        aux++;
      }
      if (featureLoc == 'T' || featureLoc == true) {
        columnas_gam[aux] = new nlobjSearchColumn("location");
        aux++;
      }


      var search_gam = nlapiCreateSearch('globalaccountmapping', filtros_gam, columnas_gam);
      var result_gam = search_gam.runSearch().getResults(0, 1000);
      if (result_gam != null && result_gam.length > 0) {
        for (var i = 0; i < result_gam.length; i++) {
          Json_GMA[result_gam[i].getValue('sourceaccount')] = {
            'destination': result_gam[i].getValue('destinationaccount'),
            'enddate': result_gam[i].getValue('enddate')
          }
          if (featureDep == 'T' || featureDep == true) {
            Json_GMA[result_gam[i].getValue('sourceaccount')]['department'] = result_gam[i].getValue('department');
          }
          if (featureCla == 'T' || featureCla == true) {
            Json_GMA[result_gam[i].getValue('sourceaccount')]['class'] = result_gam[i].getValue('class');
          }
          if (featureLoc == 'T' || featureLoc == true) {
            Json_GMA[result_gam[i].getValue('sourceaccount')]['location'] = result_gam[i].getValue('location');
          }
        }
      }
    }
  } catch (err) {
    nlapiLogExecution('ERROR', 'getCuenta', err);
    throw ' [ getCuenta ] ' + err;
  }
}

/*******************************************************
 * Funcion que cambia el '&lt;g' o '&gt;g' por '>' 0 '<'
 * (FE - Brasil)
 * Parámetros :
 *      xml : cadena a la que se le realizara el cambio
 ******************************************************/
function replaceXML(xml) {
  xml = xml.replace(/</g, '<');
  xml = xml.replace(/>/g, '>');
  xml = xml.replace(/&lt;/g, '<');
  xml = xml.replace(/&gt;/g, '>');
  return xml;
}

/***********************************************
 * Funcion que da formato al campo fecha YYMMDD
 * Parámetros :
 *      date : fecha
 **********************************************/
function yyymmdd(dateString) {

  if (dateString == '' || dateString == null) {
    return '';
  }

  var date = new Date(dateString);

  var year = date.getFullYear();

  var month = "" + (date.getMonth() + 1);

  if (month.length < 2)
    month = "0" + month;

  var date = "" + date.getDate();
  if (date.length < 2)
    date = "0" + date;

  var fe = '' + year + "" + month + "" + date;

  return fe;
}


function getCustomSegments() {
  var customSegments = [];
  if (FEAT_CUSTOMSEGMENTS == true || FEAT_CUSTOMSEGMENTS == "T") {

    var searchSegmentRecords = nlapiCreateSearch("customrecord_lmry_setup_cust_segm",
      [
        ["isinactive", "is", "F"]
      ],
      [
        new nlobjSearchColumn("internalid"),
        new nlobjSearchColumn("custrecord_lmry_setup_cust_segm")
      ]);

    var results = searchSegmentRecords.runSearch().getResults(0, 1000);
    var segment_ids = [];

    for (var i = 0; i < results.length; i++) {
      var segment_id = results[i].getValue("custrecord_lmry_setup_cust_segm") || "";
      segment_id = segment_id.trim();
      if (segment_id) {
        segment_ids.push(segment_id);
      }
    }

    if (segment_ids.length) {
      var filterSegments = [];

      for (var i = 0; i < segment_ids.length; i++) {
        filterSegments.push("OR", ["scriptid", "is", segment_ids[i]])
      }

      filterSegments = filterSegments.slice(1);

      var filters = [
        ["isinactive", "is", "F"], "AND",
        ["glimpact", "is", "T"], "AND",
        filterSegments
      ];

      var searchSegments = nlapiCreateSearch("customsegment", filters,
        [
          new nlobjSearchColumn("internalid").setSort(false),
          new nlobjSearchColumn("scriptid")]);

      var results = searchSegments.runSearch().getResults(0, 1000);

      for (var i = 0; i < results.length; i++) {
        var segment_id = results[i].getValue("scriptid");
        customSegments.push(segment_id);
      }
    }
  }
  return customSegments;
}

function getExchangeRateByBook(transactionRecord, book) {
  var exchangeRate_mb = 1;
  if (book.isPrimary()) {
    exchangeRate_mb = transactionRecord.getFieldValue("exchangerate");
  } else {
    var bookId = book.getId();
    for (var line = 1; line <= transactionRecord.getLineItemCount('accountingbookdetail'); line++) {
      if (bookId == transactionRecord.getLineItemValue('accountingbookdetail', 'bookid', line)) {
        exchangeRate_mb = transactionRecord.getLineItemValue('accountingbookdetail', 'exchangerate', line);
        break;
      }
    }
  }
  return exchangeRate_mb;
}

function round2(num) {
  var e = (num >= 0) ? 1e-3 : -1e-3;
  return parseFloat(Math.round(parseFloat(num) * 1e2 + e) / 1e2);
}

function round4(num) {
  var e = (num >= 0) ? 1e-3 : -1e-3;
  return parseFloat(Math.round(parseFloat(num) * 1e4 + e) / 1e4);
}

function round(num, d) {
  d = d || 2;
  var q = Math.pow(10, d);
  var e = (parseFloat(num) >= 0) ? 1e-3 : -1e-3;
  return Math.round(parseFloat(num) * q + e) / q;
}

function getTaxCalculatorConfigTaxes(transactionRecord) {
  var configTaxes = {}
  var typeTransactions = {
    "sales": ["invoice", "creditmemo", "salesorder"], "purchase": ["vendorbill", "purchaseorder"]
  };
  var type = transactionRecord.getFieldValue("baserecordtype");
  var subsidiary = transactionRecord.getFieldValue("subsidiary")
  nlapiLogExecution("ERROR", "typeTransaction", type);
  // Filtros
  var filters = [];
  if (typeTransactions["sales"].indexOf(type) != -1) {
    filters.push(new nlobjSearchFilter("custrecord_lmry_br_config_debitaccount", null, "noneof", "@NONE@"));
    filters.push(new nlobjSearchFilter("custrecord_lmry_br_config_creditaccount", null, "noneof", "@NONE@"));
  } else if (typeTransactions["purchase"].indexOf(type) != -1) {
    filters.push(new nlobjSearchFilter("custrecord_lmry_br_config_debitacc_purch", null, "noneof", "@NONE@"));
    filters.push(new nlobjSearchFilter("custrecord_lmry_br_config_creditacc_purc", null, "noneof", "@NONE@"));
  } else if (type == "itemfulfillment") {
    filters.push(new nlobjSearchFilter("custrecord_lmry_br_config_shipm_credtacc", null, "noneof", "@NONE@"));
    filters.push(new nlobjSearchFilter("custrecord_lmry_br_config_tror_bridgeacc", null, "noneof", "@NONE@"));
  } else if (type == "itemreceipt") {
    filters.push(new nlobjSearchFilter("custrecord_lmry_br_config_recpt_debitacc", null, "noneof", "@NONE@"));
    filters.push(new nlobjSearchFilter("custrecord_lmry_br_config_tror_bridgeacc", null, "noneof", "@NONE@"));
  }

  filters.push(new nlobjSearchFilter("custrecord_lmry_br_config_typeitem", null, "anyof", "1")); //InvtPart
  filters.push(new nlobjSearchFilter("isinactive", null, "is", 'F'));
  if (featureSubs == 'T' || featureSubs) {
    filters.push(new nlobjSearchFilter("custrecord_lmry_br_config_subsidiary", null, "anyof", subsidiary));
  }
  // Columnas
  var columns = [
    //columnas.push(new nlobjSearchColumn("custrecord_lmry_br_config_typeitem"));
    new nlobjSearchColumn("custrecord_lmry_br_config_subtype"),
    new nlobjSearchColumn("custrecord_lmry_br_config_debitaccount"),
    new nlobjSearchColumn("custrecord_lmry_br_config_creditaccount"),
    new nlobjSearchColumn("custrecord_lmry_br_config_debitacc_purch"),
    new nlobjSearchColumn("custrecord_lmry_br_config_creditacc_purc"),
    new nlobjSearchColumn("custrecord_lmry_br_config_shipm_credtacc"),
    new nlobjSearchColumn("custrecord_lmry_br_config_tror_bridgeacc"),
    new nlobjSearchColumn("custrecord_lmry_br_config_recpt_debitacc"),
    new nlobjSearchColumn("custrecord_lmry_br_config_department"),
    new nlobjSearchColumn("custrecord_lmry_br_config_class"),
    new nlobjSearchColumn("custrecord_lmry_br_config_location"),
    new nlobjSearchColumn("custrecord_lmry_br_config_customsegments")
  ];

  var searchTaxConfigs = nlapiCreateSearch("customrecord_lmry_tax_config_br", filters, columns);
  var results = searchTaxConfigs.runSearch().getResults(0, 1000);
  if (results && results.length) {
    for (var i = 0; i < results.length; i++) {
      var subtype = results[i].getText("custrecord_lmry_br_config_subtype").trim();
      var debitAccount;
      var creditAccount;

      if (typeTransactions["sales"].indexOf(type) != -1) {
        debitAccount = results[i].getValue("custrecord_lmry_br_config_debitaccount");
        creditAccount = results[i].getValue("custrecord_lmry_br_config_creditaccount")
      } else if (typeTransactions["purchase"].indexOf(type) != -1) {
        debitAccount = results[i].getValue("custrecord_lmry_br_config_debitacc_purch");
        creditAccount = results[i].getValue("custrecord_lmry_br_config_creditacc_purc");
      } else if (type == "itemfulfillment") {
        debitAccount = results[i].getValue("custrecord_lmry_br_config_tror_bridgeacc");
        creditAccount = results[i].getValue("custrecord_lmry_br_config_shipm_credtacc");
      } else if (type == "itemreceipt") {
        debitAccount = results[i].getValue("custrecord_lmry_br_config_recpt_debitacc");
        creditAccount = results[i].getValue("custrecord_lmry_br_config_tror_bridgeacc");
      }

      var department = results[i].getValue("custrecord_lmry_br_config_department");
      var class_ = results[i].getValue("custrecord_lmry_br_config_class");
      var location = results[i].getValue("custrecord_lmry_br_config_location");
      var objSegments = results[i].getValue("custrecord_lmry_br_config_customsegments");
      if (objSegments) {
        objSegments = JSON.parse(objSegments);
      }

      if (debitAccount && creditAccount) {
        configTaxes[subtype] = {
          'debitaccount': debitAccount,
          'creditaccount': creditAccount,
          'department': department,
          'class': class_,
          'location': location
        };

        if (objSegments && Object.keys(objSegments).length) {
          for (var s = 0; s < customSegments.length; s++) {
            var segmentId = customSegments[s];
            if (objSegments[segmentId]) {
              configTaxes[subtype][segmentId] = objSegments[segmentId]
            }
          }
        }
      }
    }
  }
  return configTaxes;
}

function validateMemo(transactionRecord) {
  var MEMOS = ["Reference VOID", "(LatamTax -  WHT)", "Latam - Interest and Penalty", "Voided Latam - WHT"];
  var memo = transactionRecord.getFieldValue("memo");
  for (var i = 0; i < MEMOS.length; i++) {
    if (memo.substring(0, MEMOS[i].length) == MEMOS[i]) {
      return false;
    }
  }

  return true;
}

function getDiscountAmounts(transactionRecord) {
  var discountAmounts = {};
  var numItems = transactionRecord.getLineItemCount("item");
  var discountAmount = 0.00, currentItemPosition = 0;
  for (var i = 1; i <= numItems; i++) {
    var typeDiscount = transactionRecord.getLineItemValue("item", "custcol_lmry_col_sales_type_discount", i);
    if (typeDiscount) {
      if (Number(typeDiscount) == 1) {
        var amount = transactionRecord.getLineItemValue("item", "amount", i) || 0.00;
        discountAmount += parseFloat(amount);
      }
    } else {
      if (currentItemPosition) {
        discountAmounts[String(currentItemPosition)] = Math.abs(discountAmount);
      }
      currentItemPosition = i;
      discountAmount = 0.00;
    }
  }

  if (currentItemPosition) {
    discountAmounts[String(currentItemPosition)] = Math.abs(discountAmount);
  }

  return discountAmounts;
}


function checkIsTaxCalculator(transactionRecord) {
  var numItems = transactionRecord.getLineItemCount("item");
  for (var i = 1; i <= numItems; i++) {
    var catalog = transactionRecord.getLineItemValue("item", "custcol_lmry_br_service_catalog", i);
    var brTaxRule = transactionRecord.getLineItemValue("item", "custcol_lmry_br_tax_rule", i);
    if (catalog || brTaxRule) {
      isTaxCalculator = false;
      return false;
    }
  }
  return true;
}

function getCatalogFilters(transactionRecord, taxFlow, serviceCatalogField, nfceCatalogField) {
  var filters = [];
  var numItems = transactionRecord.getLineItemCount("item");
  var serviceCatalogs = [], nfceCatalogs = [];
  for (var i = 1; i <= numItems; i++) {
    var serviceCatalog = transactionRecord.getLineItemValue("item", "custcol_lmry_br_service_catalog", i) || "";
    serviceCatalog = Number(serviceCatalog);
    var nfceCatalog = transactionRecord.getLineItemValue("item", "custcol_lmry_br_nfce_catalog", i) || "";
    nfceCatalog = Number(nfceCatalog);

    if (serviceCatalog && serviceCatalogs.indexOf(serviceCatalog) == -1) {
      serviceCatalogs.push(serviceCatalog);
    }

    if (nfceCatalog && nfceCatalogs.indexOf(nfceCatalog) == -1) {
      nfceCatalogs.push(nfceCatalog);
    }
  }

  if (serviceCatalogs.length) {
    filters.push([serviceCatalogField, "anyof", serviceCatalogs]);
  }

  var isHybrid = false;
  if (getAuthorization(722, licenses)) {
    isHybrid = transactionRecord.getFieldValue("custbody_lmry_tax_tranf_gratu");
    isHybrid = (isHybrid == true || isHybrid == "T");
  }

  if (nfceCatalogs.length && Number(taxFlow) == 4 && isHybrid) {

    for (var i = 0; i < nfceCatalogs.length; i++) {
      filters.push("OR", [nfceCatalogField, "equalto", nfceCatalogs[i]])
    }

    if (!serviceCatalogs.length) {
      filters = filters.slice(1);
    }
  }

  return filters;
}
