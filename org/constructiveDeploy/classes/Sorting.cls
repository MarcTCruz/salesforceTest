public with sharing class Sorting {
    public Integer[] numbersSorted(Integer[] values) {
        // Implement sorting without using Salesforce standart sort
        Integer[] tmpValues = new Integer[values.size() / 2];
        for(Integer i = 0; i < tmpValues.size(); i+=2){
            //order each pair
            if(values[i] > values[i + 1]){
                Integer tmp = values[i];
                values[i] = values[i + 1];
                values[i + 1] = tmp; 
            }
        }
        return values;
    }
}